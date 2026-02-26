<script setup>
import ProductService from '@/services/ProductService';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const apiBase = import.meta.env.VITE_APP_API;
const toast = useToast();
const router = useRouter();

// รับข้อมูล PR ที่เลือกมาจาก history.state
const selectedPRs = ref([]);
const isLoadingItems = ref(false);
const isSaving = ref(false);
const showConfirmDialog = ref(false);

// Header
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const genDocNo = () => {
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let guid = '';
    for (let i = 0; i < 3; i++) guid += letters[Math.floor(Math.random() * 26)];
    guid += pad(Math.floor(Math.random() * 100));
    return `MPO${y}${m}${d}-${guid}`;
};

const docNo = ref(genDocNo());
const docDate = ref(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
const docTime = ref(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
const remark = ref('');
const custCode = ref('');
const editItems = ref([]);
const totalDiscount = ref(0);

// Warehouse & Shelf
const warehouseList = ref([]);
const selectedWarehouse = ref(null);
const selectedShelf = ref(null);
const shelfList = ref([]);
const isLoadingShelf = ref(false);

async function loadWarehouses() {
    try {
        const res = await axios.get(`${apiBase}/getWarehouseList`);
        warehouseList.value = res.data?.data || [];
    } catch (e) {
        console.error('loadWarehouses error:', e);
    }
}

async function onWarehouseChange() {
    shelfList.value = [];
    selectedShelf.value = null;
    if (!selectedWarehouse.value) return;
    isLoadingShelf.value = true;
    try {
        const res = await axios.get(`${apiBase}/getShelfList`, { params: { wh_code: selectedWarehouse.value.code } });
        shelfList.value = res.data?.data || [];
    } catch (e) {
        console.error('getShelfList error:', e);
    } finally {
        isLoadingShelf.value = false;
    }
}

watch(selectedWarehouse, () => {
    onWarehouseChange();
});

// ประเภทภาษี
const taxType = ref(1);
const taxTypeOptions = [
    { label: '0 - ภาษีแยกนอก', value: 0 },
    { label: '1 - ภาษีรวมใน', value: 1 },
    { label: '2 - ภาษีอัตราศูนย์', value: 2 },
    { label: '3 - ไม่กระทบภาษี', value: 3 }
];

const vatRate = ref(7);

async function loadVatRate() {
    try {
        const res = await axios.get(`${apiBase}/getVatRate`);
        vatRate.value = parseFloat(res.data?.vat_rate) || 7;
    } catch (e) {
        vatRate.value = 7;
    }
}

// มูลค่าสินค้าทั้งหมด
const totalValue = computed(() => editItems.value.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0));

// มูลค่ายกเว้นภาษี (item tax_type = '1')
const totalExceptVat = computed(() => editItems.value.filter((i) => String(i.tax_type) === '1').reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0));

// มูลค่าสินค้าที่ต้องคิดภาษี หลังหักส่วนลด
const taxableBase = computed(() => {
    const vatItems = editItems.value.filter((i) => String(i.tax_type) !== '1').reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0);
    const discount = parseFloat(totalDiscount.value) || 0;
    return Math.max(0, vatItems - discount);
});

// คำนวณภาษีตาม taxType
const vatCalc = computed(() => {
    const rate = parseFloat(vatRate.value) || 0;
    const base = taxableBase.value;
    const discount = parseFloat(totalDiscount.value) || 0;
    const exceptVat = totalExceptVat.value;
    const tv = totalValue.value;

    let beforeVat = 0,
        vatValue = 0,
        afterVat = 0,
        amount = 0;

    if (taxType.value === 0) {
        beforeVat = base;
        vatValue = parseFloat(((beforeVat * rate) / 100).toFixed(2));
        afterVat = parseFloat((beforeVat + vatValue).toFixed(2));
        amount = parseFloat((afterVat + exceptVat).toFixed(2));
    } else if (taxType.value === 1) {
        afterVat = base;
        beforeVat = parseFloat((afterVat / (1 + rate / 100)).toFixed(2));
        vatValue = parseFloat((afterVat - beforeVat).toFixed(2));
        amount = parseFloat((tv - discount).toFixed(2));
    } else {
        beforeVat = 0;
        vatValue = 0;
        afterVat = 0;
        amount = parseFloat((tv - discount).toFixed(2));
    }

    return { beforeVat, vatValue, afterVat, exceptVat, amount };
});

const totalAmount = computed(() => vatCalc.value.amount);

async function loadPRAItems() {
    if (selectedPRs.value.length === 0) return;
    isLoadingItems.value = true;
    try {
        const payload = selectedPRs.value.map((pr) => ({ doc_no: pr.doc_no }));
        const res = await axios.post(`${apiBase}/getPRADetail`, payload);
        const items = res.data?.data?.items || [];
        editItems.value = items.map((item) => ({
            ...item,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0
        }));
        if (selectedPRs.value[0]?.cust_code) {
            custCode.value = selectedPRs.value[0].cust_code;
        }
    } catch (e) {
        console.error('loadPRAItems error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถโหลดรายการสินค้าได้', life: 3000 });
    } finally {
        isLoadingItems.value = false;
    }
}

async function createPO() {
    if (!selectedWarehouse.value || !selectedShelf.value) {
        toast.add({ severity: 'warn', summary: 'กรุณาเลือกคลังและที่เก็บ', detail: 'ต้องเลือกคลังสินค้าและที่เก็บก่อนสร้าง PO', life: 3000 });
        return;
    }
    isSaving.value = true;
    showConfirmDialog.value = false;
    try {
        const empCode = localStorage.getItem('_empCode') || '';
        const whCode = selectedWarehouse.value.code;
        const calc = vatCalc.value;
        const discountValue = parseFloat(totalDiscount.value) || 0;

        const mappedItems = editItems.value.map((item) => ({
            doc_no: item.doc_no || '',
            item_code: item.item_code,
            item_name: item.item_name,
            unit_code: item.unit_code,
            qty: String(item.qty),
            price: String(item.price),
            sum_amount: String((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)),
            stand_value: item.stand_value || '1',
            divide_value: item.divide_value || '1',
            ratio: item.ratio || '1',
            tax_type: item.tax_type || '0',
            wh_code: whCode,
            shelf_code: selectedShelf.value?.code || ''
        }));

        const payload = {
            doc_no: docNo.value,
            doc_date: docDate.value,
            doc_time: docTime.value,
            cust_code: custCode.value,
            branch_code: whCode,
            emp_code: empCode,
            remark: remark.value,
            sale_type: '0',
            tax_type: String(taxType.value),
            vat_rate: String(vatRate.value),
            total_value: String(totalValue.value),
            total_discount: String(discountValue),
            total_before_vat: String(calc.beforeVat),
            total_vat_value: String(calc.vatValue),
            total_after_vat: String(calc.afterVat),
            total_except_vat: String(calc.exceptVat),
            total_amount: String(calc.amount),
            doc_list: selectedPRs.value.map((pr) => ({ doc_no: pr.doc_no, doc_date: pr.doc_date })),
            items: mappedItems
        };

        await axios.post(`${apiBase}/createPoDoc`, payload);
        toast.add({ severity: 'success', summary: 'สร้าง PO สำเร็จ', detail: docNo.value, life: 4000 });
        router.push({ name: 'po-list' });
    } catch (e) {
        console.error('createPO error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถสร้าง PO ได้', life: 3000 });
    } finally {
        isSaving.value = false;
    }
}

function formatNumber(value) {
    if (value === undefined || value === null) return '0.00';
    const num = parseFloat(value);
    return !isNaN(num) ? num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
}

function getProductImage(itemCode) {
    return itemCode ? ProductService.getProductImageUrl(itemCode) : 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

function handleImageError(event) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

onMounted(async () => {
    try {
        const raw = history.state?.selectedPRs;
        if (raw) selectedPRs.value = JSON.parse(raw);
    } catch (e) {
        console.error('parse selectedPRs error:', e);
    }
    await Promise.all([loadWarehouses(), loadPRAItems(), loadVatRate()]);
});
</script>

<template>
    <Toast />
    <div class="p-4">
        <!-- Header bar -->
        <div class="flex items-center gap-3 mb-4">
            <Button icon="pi pi-arrow-left" text rounded @click="router.back()" />
            <h2 class="text-xl font-bold">สร้างใบสั่งซื้อ (PO)</h2>
        </div>

        <!-- Document header -->
        <div class="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 shadow-sm">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">เลขที่เอกสาร</label>
                    <InputText v-model="docNo" class="w-full font-mono bg-gray-50 dark:bg-gray-800" readonly />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">วันที่</label>
                    <InputText v-model="docDate" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">เวลา</label>
                    <InputText v-model="docTime" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">เจ้าหนี้</label>
                    <InputText v-model="custCode" class="w-full bg-gray-50 dark:bg-gray-800" readonly />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">คลังสินค้า</label>
                    <Select v-model="selectedWarehouse" :options="warehouseList" optionLabel="name" placeholder="เลือกคลัง" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">ที่เก็บ</label>
                    <Select v-model="selectedShelf" :options="shelfList" optionLabel="name" placeholder="เลือกที่เก็บ" class="w-full" :disabled="!selectedWarehouse" :loading="isLoadingShelf" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">ประเภทภาษี</label>
                    <Select v-model="taxType" :options="taxTypeOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                    <label class="text-sm font-medium">หมายเหตุ</label>
                    <InputText v-model="remark" class="w-full" placeholder="ระบุหมายเหตุ (ถ้ามี)" />
                </div>
            </div>

            <!-- PR ที่เลือก -->
            <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500">
                <span class="font-medium">อ้างอิง PR:</span>
                <span v-for="pr in selectedPRs" :key="pr.doc_no" class="ml-2 inline-block bg-primary-50 dark:bg-primary-900/30 text-primary px-2 py-0.5 rounded text-xs">
                    {{ pr.doc_no }}
                </span>
            </div>
        </div>

        <!-- Items table -->
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden mb-4">
            <div v-if="isLoadingItems" class="flex justify-center items-center py-12">
                <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
            </div>

            <div v-else-if="editItems.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-400">
                <i class="pi pi-box text-5xl mb-3"></i>
                <div>ไม่พบรายการสินค้า</div>
            </div>

            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-3 py-2 font-medium">เอกสาร</th>
                            <th class="text-left px-3 py-2 font-medium w-12">รูป</th>
                            <th class="text-left px-3 py-2 font-medium">รหัส</th>
                            <th class="text-left px-3 py-2 font-medium">ชื่อสินค้า</th>
                            <th class="text-center px-3 py-2 font-medium">หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium text-gray-400">ต่ำสุด</th>
                            <th class="text-right px-3 py-2 font-medium text-gray-400">สูงสุด</th>
                            <th class="text-right px-3 py-2 font-medium w-28">จำนวนสั่ง</th>
                            <th class="text-right px-3 py-2 font-medium w-32">ราคา/หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium w-32">รวม</th>
                            <th class="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in editItems" :key="idx" class="border-t border-gray-100 dark:border-gray-800">
                            <td class="px-3 py-2 font-medium">{{ item.doc_no }}</td>
                            <td class="px-3 py-2">
                                <div class="w-10 h-10 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                                    <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain" @error="handleImageError" />
                                </div>
                            </td>
                            <td class="px-3 py-2 font-medium">{{ item.item_code }}</td>
                            <td class="px-3 py-2">{{ item.item_name }}</td>
                            <td class="px-3 py-2 text-center">{{ item.unit_code }}</td>
                            <td class="px-3 py-2 text-right text-gray-400">{{ item.minimum_qty }}</td>
                            <td class="px-3 py-2 text-right text-gray-400">{{ item.maximum_qty }}</td>
                            <td class="px-3 py-2">
                                <InputNumber v-model="item.qty" :min="0" :maxFractionDigits="2" class="w-full" inputClass="text-right" />
                            </td>
                            <td class="px-3 py-2">
                                <InputNumber v-model="item.price" :min="0" :maxFractionDigits="2" class="w-full" inputClass="text-right" />
                            </td>
                            <td class="px-3 py-2 text-right font-medium">
                                {{ formatNumber((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)) }}
                            </td>
                            <td class="px-3 py-2 text-center">
                                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="editItems.splice(idx, 1)" />
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="text-sm">
                        <tr class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <td colspan="9" class="px-3 py-1.5 text-right text-gray-500">มูลค่าสินค้า</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(totalValue) }}</td>
                        </tr>

                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="9" class="px-3 py-1.5 text-right text-gray-500">ยอดก่อนภาษี</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(vatCalc.beforeVat) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="9" class="px-3 py-1.5 text-right text-gray-500">ภาษีมูลค่าเพิ่ม ({{ vatRate }}%)</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(vatCalc.vatValue) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="9" class="px-3 py-1.5 text-right text-gray-500">ยอดหลังภาษี</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(vatCalc.afterVat) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="9" class="px-3 py-1.5 text-right text-gray-500">ยกเว้นภาษี</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(vatCalc.exceptVat) }}</td>
                        </tr>
                        <tr class="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                            <td colspan="9" class="px-3 py-2 text-right">มูลค่าสุทธิ</td>
                            <td class="px-3 py-2 text-right text-primary text-base">{{ formatNumber(totalAmount) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <!-- Action buttons -->
        <div class="flex justify-between">
            <Button label="ยกเลิก" icon="pi pi-arrow-left" severity="secondary" outlined @click="router.back()" />
            <Button label="สร้าง PO" icon="pi pi-check" severity="success" @click="showConfirmDialog = true" :disabled="editItems.length === 0 || !selectedWarehouse || !selectedShelf || isSaving" />
        </div>

        <!-- Confirm Dialog -->
        <Dialog v-model:visible="showConfirmDialog" modal header="ยืนยันสร้างใบสั่งซื้อ" :style="{ width: '420px' }" :draggable="false">
            <div class="flex items-start gap-3 py-2">
                <i class="pi pi-question-circle text-3xl text-primary mt-1"></i>
                <div>
                    <div class="font-medium mb-2">ยืนยันการสร้างใบสั่งซื้อ?</div>
                    <div class="text-sm text-gray-500 mb-1">
                        เลขที่: <span class="font-mono font-medium text-gray-800 dark:text-gray-200">{{ docNo }}</span>
                    </div>
                    <div class="text-sm text-gray-500 mb-1">เจ้าหนี้: {{ custCode }}</div>
                    <div class="text-sm text-gray-500 mb-1">รายการสินค้า: {{ editItems.length }} รายการ</div>
                    <div class="text-sm font-semibold mt-2">มูลค่าสุทธิ: ฿{{ formatNumber(totalAmount) }}</div>
                </div>
            </div>
            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showConfirmDialog = false" />
                <Button label="ยืนยันสร้าง PO" icon="pi pi-check" severity="success" @click="createPO" :loading="isSaving" />
            </template>
        </Dialog>
    </div>
</template>
