<script setup>
import ProductService from '@/services/ProductService';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
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

const totalAmount = computed(() =>
    editItems.value.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0)
);

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
        // ใช้ cust_code จาก PR แรก
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
    isSaving.value = true;
    showConfirmDialog.value = false;
    try {
        const empCode = localStorage.getItem('_empCode') || '';
        const whCode = localStorage.getItem('_selectedWarehouse')
            ? JSON.parse(localStorage.getItem('_selectedWarehouse')).code
            : '';

        const mappedItems = editItems.value.map((item) => ({
            item_code: item.item_code,
            item_name: item.item_name,
            unit_code: item.unit_code,
            qty: String(item.qty),
            price: String(item.price),
            sum_amount: String((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)),
            stand_value: item.stand_value || '1',
            divide_value: item.divide_value || '1',
            ratio: item.ratio || '1',
            tax_type: item.tax_type || '0'
        }));

        const totalValue = mappedItems.reduce((s, i) => s + (parseFloat(i.sum_amount) || 0), 0);
        const totalExceptVat = mappedItems.filter((i) => i.tax_type === '1').reduce((s, i) => s + (parseFloat(i.sum_amount) || 0), 0);
        const totalAfterVat = mappedItems.filter((i) => i.tax_type === '0').reduce((s, i) => s + (parseFloat(i.sum_amount) || 0), 0);

        const payload = {
            doc_no: docNo.value,
            doc_date: docDate.value,
            doc_time: docTime.value,
            cust_code: custCode.value,
            branch_code: whCode,
            emp_code: empCode,
            remark: remark.value,
            total_value: String(totalValue),
            total_except_vat: String(totalExceptVat),
            total_after_vat: String(totalAfterVat),
            total_amount: String(totalValue),
            doc_list: selectedPRs.value.map((pr) => ({ doc_no: pr.doc_no, doc_date: pr.doc_date })),
            items: mappedItems
        };

        await axios.post(`${apiBase}/createPoDoc`, payload);
        toast.add({ severity: 'success', summary: 'สร้าง PO สำเร็จ', detail: docNo.value, life: 4000 });
        // ไปหน้า PO list และ filter ด้วยเลขที่ที่สร้าง
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

onMounted(() => {
    try {
        const raw = history.state?.selectedPRs;
        if (raw) {
            selectedPRs.value = JSON.parse(raw);
        }
    } catch (e) {
        console.error('parse selectedPRs error:', e);
    }
    loadPRAItems();
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
                <div class="flex flex-col gap-1 sm:col-span-2">
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
                    <tfoot>
                        <tr class="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                            <td colspan="9" class="px-3 py-2 text-right">ยอดรวม</td>
                            <td class="px-3 py-2 text-right text-primary text-base">{{ formatNumber(totalAmount) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <!-- Action buttons -->
        <div class="flex justify-between">
            <Button label="ยกเลิก" icon="pi pi-arrow-left" severity="secondary" outlined @click="router.back()" />
            <Button label="สร้าง PO" icon="pi pi-check" severity="success" @click="showConfirmDialog = true" :disabled="editItems.length === 0 || isSaving" />
        </div>

        <!-- Confirm Dialog -->
        <Dialog v-model:visible="showConfirmDialog" modal header="ยืนยันสร้างใบสั่งซื้อ" :style="{ width: '420px' }" :draggable="false">
            <div class="flex items-start gap-3 py-2">
                <i class="pi pi-question-circle text-3xl text-primary mt-1"></i>
                <div>
                    <div class="font-medium mb-2">ยืนยันการสร้างใบสั่งซื้อ?</div>
                    <div class="text-sm text-gray-500 mb-1">เลขที่: <span class="font-mono font-medium text-gray-800 dark:text-gray-200">{{ docNo }}</span></div>
                    <div class="text-sm text-gray-500 mb-1">เจ้าหนี้: {{ custCode }}</div>
                    <div class="text-sm text-gray-500 mb-1">รายการสินค้า: {{ editItems.length }} รายการ</div>
                    <div class="text-sm font-semibold mt-2">ยอดรวม: ฿{{ formatNumber(totalAmount) }}</div>
                </div>
            </div>
            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showConfirmDialog = false" />
                <Button label="ยืนยันสร้าง PO" icon="pi pi-check" severity="success" @click="createPO" :loading="isSaving" />
            </template>
        </Dialog>
    </div>
</template>
