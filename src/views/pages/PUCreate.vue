<script setup>
import ProductService from '@/services/ProductService';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const apiBase = import.meta.env.VITE_APP_API;
const toast = useToast();
const router = useRouter();

const selectedPOs = ref([]);
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
    return `MPU${y}${m}${d}-${guid}`;
};

const docNo = ref(genDocNo());
const docDate = ref(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
const docTime = ref(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
const remark = ref('');
const custCode = ref('');
const custName = ref('');
const editItems = ref([]);
// เก็บทุก items ของ PO (รวม updateable=1) เพื่อใช้เช็ค doc_success
const allPoItems = ref([]);

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

const totalAmount = computed(() =>
    editItems.value.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0)
);

async function loadPOItems() {
    if (selectedPOs.value.length === 0) return;
    isLoadingItems.value = true;
    try {
        // ดึงทีละ PO แล้วรวม items เข้าด้วยกัน
        const results = await Promise.all(
            selectedPOs.value.map((po) =>
                axios.get(`${apiBase}/getDocPoDetail`, { params: { doc_no: po.doc_no } })
            )
        );
        const allItems = [];
        const allPo = [];
        for (const res of results) {
            const data = res.data?.data || {};
            const items = data.items || [];
            if (!custCode.value && data.cust_code) {
                custCode.value = data.cust_code;
                custName.value = data.cust_name || '';
            }
            for (const item of items) {
                const mapped = {
                    ...item,
                    qty: parseFloat(item.balance_qty) || 0,
                    po_qty: parseFloat(item.po_qty) || 0,
                    balance_qty: parseFloat(item.balance_qty) || 0,
                    price: parseFloat(item.price) || 0,
                    wh_code: item.wh_code || '',
                    shelf_code: item.shelf_code || ''
                };
                allPo.push(mapped);
                // แสดงเฉพาะรายการที่ยังค้างรับ (balance_qty > 0)
                if (mapped.balance_qty > 0) allItems.push(mapped);
            }
        }
        allPoItems.value = allPo;
        editItems.value = allItems;
        if (!custCode.value && selectedPOs.value[0]?.cust_code) {
            custCode.value = selectedPOs.value[0].cust_code;
            custName.value = selectedPOs.value[0].cust_name || '';
        }
    } catch (e) {
        console.error('loadPOItems error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถโหลดรายการสินค้าได้', life: 3000 });
    } finally {
        isLoadingItems.value = false;
    }
}

async function createPU() {
    isSaving.value = true;
    showConfirmDialog.value = false;
    try {
        const empCode = localStorage.getItem('_empCode') || '';
        const whCode = selectedWarehouse.value?.code || '';

        const shelfCode = selectedShelf.value?.code || '';
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
            tax_type: item.tax_type || '0',
            wh_code: item.wh_code || whCode,
            shelf_code: item.shelf_code || shelfCode
        }));

        const totalValue = mappedItems.reduce((s, i) => s + (parseFloat(i.sum_amount) || 0), 0);
        const totalExceptVat = mappedItems.filter((i) => i.tax_type === '1').reduce((s, i) => s + (parseFloat(i.sum_amount) || 0), 0);
        const totalAfterVat = mappedItems.filter((i) => i.tax_type === '0').reduce((s, i) => s + (parseFloat(i.sum_amount) || 0), 0);

        // doc_success = 1 ถ้าทุก item ใน PO รับครบ:
        // - updateable=true = รับครบแล้ว (จาก PU ก่อนหน้า)
        // - updateable=false = เช็ค qty ที่ user กรอกครั้งนี้ >= po_qty
        const allReceived = allPoItems.value.every((poItem) => {
            if (poItem.updateable) return true;
            const edit = editItems.value.find(
                (e) => e.item_code === poItem.item_code && e.unit_code === poItem.unit_code
            );
            const receivedQty = parseFloat(edit?.qty) || 0;
            return receivedQty >= (parseFloat(poItem.po_qty) || 0);
        });
        const docSuccess = allReceived ? '1' : '0';

        const payload = {
            doc_no: docNo.value,
            doc_date: docDate.value,
            doc_time: docTime.value,
            cust_code: custCode.value,
            branch_code: whCode,
            emp_code: empCode,
            remark: remark.value,
            doc_success: docSuccess,
            total_value: String(totalValue),
            total_except_vat: String(totalExceptVat),
            total_after_vat: String(totalAfterVat),
            total_amount: String(totalValue),
            doc_list: selectedPOs.value.map((po) => ({ doc_no: po.doc_no, doc_date: po.doc_date })),
            items: mappedItems
        };

        await axios.post(`${apiBase}/createPUDoc`, payload);
        toast.add({ severity: 'success', summary: 'สร้าง PU สำเร็จ', detail: docNo.value, life: 4000 });
        router.push({ name: 'pu-list' });
    } catch (e) {
        console.error('createPU error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถสร้าง PU ได้', life: 3000 });
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

// Barcode scan
const barcodeInput = ref('');
const barcodeInputRef = ref(null);
const isScanning = ref(false);

async function onBarcodeSubmit() {
    const raw = barcodeInput.value.trim();
    if (!raw) return;

    // parse รูปแบบ qty*barcode หรือ barcode เดี่ยว
    let qty = 1;
    let barcode = raw;
    const starIdx = raw.indexOf('*');
    if (starIdx > 0) {
        const maybeQty = parseFloat(raw.slice(0, starIdx));
        if (!isNaN(maybeQty) && maybeQty > 0) {
            qty = maybeQty;
            barcode = raw.slice(starIdx + 1).trim();
        }
    }

    if (!barcode) {
        barcodeInput.value = '';
        return;
    }

    isScanning.value = true;
    try {
        const res = await axios.get(`${apiBase}/getBarcodeItem`, {
            params: { barcode, custcode: custCode.value }
        });
        const data = res.data?.data?.[0];
        if (!data) {
            toast.add({ severity: 'warn', summary: 'ไม่พบสินค้า', detail: `บาร์โค้ด: ${barcode}`, life: 2500 });
            barcodeInput.value = '';
            await nextTick();
            const elErr = barcodeInputRef.value?.$el;
            if (elErr) (elErr.tagName === 'INPUT' ? elErr : elErr.querySelector('input'))?.focus();
            return;
        }

        // ถ้ามีสินค้านี้ใน list อยู่แล้ว (barcode + unit_code เดียวกัน) ให้เพิ่ม qty
        const existing = editItems.value.find(
            (i) => i.barcode === data.barcode && i.unit_code === data.unit_code
        );
        if (existing) {
            existing.qty = (parseFloat(existing.qty) || 0) + qty;
        } else {
            editItems.value.push({
                item_code: data.item_code,
                item_name: data.item_name,
                unit_code: data.unit_code,
                barcode: data.barcode || barcode,
                qty,
                price: parseFloat(data.price) || 0,
                stand_value: data.stand_value || '1',
                divide_value: data.divide_value || '1',
                ratio: data.ratio || '1',
                tax_type: data.tax_type || '0',
                wh_code: selectedWarehouse.value?.code || '',
                shelf_code: selectedShelf.value?.code || ''
            });
        }

        toast.add({ severity: 'success', summary: 'เพิ่มสินค้าแล้ว', detail: `${data.item_name} x${qty}`, life: 1500 });
    } catch (e) {
        console.error('getBarcodeItem error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถค้นหาบาร์โค้ดได้', life: 2500 });
    } finally {
        isScanning.value = false;
        barcodeInput.value = '';
        await nextTick();
        const el = barcodeInputRef.value?.$el;
        if (el) (el.tagName === 'INPUT' ? el : el.querySelector('input'))?.focus();
    }
}

// Search item dialog
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const showSearchDialog = ref(false);

async function onSearchSubmit() {
    const q = searchQuery.value.trim();
    if (!q) return;
    isSearching.value = true;
    try {
        const res = await axios.get(`${apiBase}/getBarcodeItemSearch`, {
            params: { search: q, custcode: custCode.value }
        });
        searchResults.value = res.data?.data || [];
        showSearchDialog.value = true;
    } catch (e) {
        console.error('getBarcodeItemSearch error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถค้นหาสินค้าได้', life: 2500 });
    } finally {
        isSearching.value = false;
    }
}

function addFromSearch(data, qty = 1) {
    const existing = editItems.value.find(
        (i) => i.barcode === data.barcode && i.unit_code === data.unit_code
    );
    if (existing) {
        existing.qty = (parseFloat(existing.qty) || 0) + qty;
    } else {
        editItems.value.push({
            item_code: data.item_code,
            item_name: data.item_name,
            unit_code: data.unit_code,
            barcode: data.barcode || '',
            qty,
            price: parseFloat(data.price) || 0,
            stand_value: data.stand_value || '1',
            divide_value: data.divide_value || '1',
            ratio: data.ratio || '1',
            tax_type: data.tax_type || '0',
            wh_code: selectedWarehouse.value?.code || '',
            shelf_code: selectedShelf.value?.code || ''
        });
    }
    toast.add({ severity: 'success', summary: 'เพิ่มสินค้าแล้ว', detail: `${data.item_name} (${data.unit_code})`, life: 1500 });
}

// เมื่อเลือกคลัง ให้อัพเดท wh_code ทุก item และ reset shelf
watch(selectedWarehouse, (wh) => {
    selectedShelf.value = null;
    shelfList.value = [];
    if (!wh) {
        editItems.value.forEach((item) => {
            item.wh_code = '';
            item.shelf_code = '';
        });
        return;
    }
    onWarehouseChange();
    editItems.value.forEach((item) => {
        item.wh_code = wh.code;
        item.shelf_code = '';
    });
});

// เมื่อเลือกที่เก็บ ให้อัพเดท shelf_code ทุก item
watch(selectedShelf, (shelf) => {
    const code = shelf?.code || '';
    editItems.value.forEach((item) => {
        item.shelf_code = code;
    });
});

onMounted(async () => {
    try {
        const raw = history.state?.selectedPOs;
        if (raw) selectedPOs.value = JSON.parse(raw);
    } catch (e) {
        console.error('parse selectedPOs error:', e);
    }
    await Promise.all([loadWarehouses(), loadPOItems()]);
    await nextTick();
    const el = barcodeInputRef.value?.$el;
    if (el) (el.tagName === 'INPUT' ? el : el.querySelector('input'))?.focus();
});
</script>

<template>
    <Toast />
    <div class="p-4">
        <!-- Header bar -->
        <div class="flex items-center gap-3 mb-4">
            <Button icon="pi pi-arrow-left" text rounded @click="router.back()" />
            <h2 class="text-xl font-bold">สร้างใบรับสินค้า (PU)</h2>
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
                    <InputText :modelValue="`${custCode}${custName ? '~' + custName : ''}`" class="w-full bg-gray-50 dark:bg-gray-800" readonly />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">คลัง</label>
                    <Select v-model="selectedWarehouse" :options="warehouseList" optionLabel="name" placeholder="เลือกคลัง" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">ที่เก็บ</label>
                    <Select v-model="selectedShelf" :options="shelfList" optionLabel="name" placeholder="เลือกที่เก็บ" class="w-full" :disabled="!selectedWarehouse" :loading="isLoadingShelf" />
                </div>
                <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <label class="text-sm font-medium">หมายเหตุ</label>
                    <InputText v-model="remark" class="w-full" placeholder="ระบุหมายเหตุ (ถ้ามี)" />
                </div>
            </div>

            <!-- PO ที่เลือก -->
            <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500">
                <span class="font-medium">อ้างอิง PO:</span>
                <span v-for="po in selectedPOs" :key="po.doc_no" class="ml-2 inline-block bg-primary-50 dark:bg-primary-900/30 text-primary px-2 py-0.5 rounded text-xs">
                    {{ po.doc_no }}
                </span>
            </div>
        </div>

        <!-- Barcode scan + Search -->
        <div class="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 shadow-sm">
            <div class="flex flex-col sm:flex-row gap-3">
                <!-- Barcode -->
                <div class="flex gap-2 flex-1 items-end">
                    <div class="flex flex-col gap-1 flex-1">
                        <label class="text-sm font-medium">สแกนบาร์โค้ด <span class="text-gray-400 font-normal text-xs">(เช่น 10*8850025122230)</span></label>
                        <InputText
                            ref="barcodeInputRef"
                            v-model="barcodeInput"
                            placeholder="สแกนหรือพิมพ์บาร์โค้ด"
                            class="w-full font-mono"
                            @keyup.enter="onBarcodeSubmit"
                            :disabled="isScanning"
                            autofocus
                        />
                    </div>
                    <Button icon="pi pi-barcode" @click="onBarcodeSubmit" :loading="isScanning" :disabled="!barcodeInput.trim()" v-tooltip.top="'เพิ่มจากบาร์โค้ด'" />
                </div>

                <div class="hidden sm:flex items-end pb-0.5 text-gray-300">|</div>

                <!-- Search -->
                <div class="flex gap-2 flex-1 items-end">
                    <div class="flex flex-col gap-1 flex-1">
                        <label class="text-sm font-medium">ค้นหาสินค้า</label>
                        <InputText
                            v-model="searchQuery"
                            placeholder="ชื่อสินค้า / รหัส / บาร์โค้ด"
                            class="w-full"
                            @keyup.enter="onSearchSubmit"
                            :disabled="isSearching"
                        />
                    </div>
                    <Button icon="pi pi-search" @click="onSearchSubmit" :loading="isSearching" :disabled="!searchQuery.trim()" v-tooltip.top="'ค้นหาสินค้า'" />
                </div>
            </div>
        </div>

        <!-- Search Result Dialog -->
        <Dialog v-model:visible="showSearchDialog" modal header="ผลการค้นหาสินค้า" :style="{ width: '95%', maxWidth: '700px' }" :draggable="false">
            <div v-if="searchResults.length === 0" class="text-center text-gray-400 py-6">ไม่พบสินค้า</div>
            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-3 py-2 font-medium w-12">รูป</th>
                            <th class="text-left px-3 py-2 font-medium">รหัส</th>
                            <th class="text-left px-3 py-2 font-medium">ชื่อสินค้า</th>
                            <th class="text-center px-3 py-2 font-medium">หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium">ราคา</th>
                            <th class="text-center px-3 py-2 font-medium w-20">เพิ่ม</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in searchResults" :key="idx" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-3 py-2">
                                <div class="w-10 h-10 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                                    <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain" @error="handleImageError" />
                                </div>
                            </td>
                            <td class="px-3 py-2 font-medium text-xs">{{ item.item_code }}</td>
                            <td class="px-3 py-2">
                                <div>{{ item.item_name }}</div>
                                <div class="text-xs text-gray-400 font-mono">{{ item.barcode }}</div>
                            </td>
                            <td class="px-3 py-2 text-center">{{ item.unit_code }}</td>
                            <td class="px-3 py-2 text-right">{{ formatNumber(item.price) }}</td>
                            <td class="px-3 py-2 text-center">
                                <Button icon="pi pi-plus" severity="success" rounded size="small" @click="addFromSearch(item)" v-tooltip.top="'เพิ่ม 1 ชิ้น'" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <template #footer>
                <Button label="ปิด" icon="pi pi-times" severity="secondary" outlined @click="showSearchDialog = false" />
            </template>
        </Dialog>

        <!-- Items table -->
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden mb-4">
            <div v-if="isLoadingItems" class="flex justify-center items-center py-12">
                <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
            </div>

            <div v-else-if="editItems.length === 0" class="flex flex-col items-center justify-center py-8 text-gray-400">
                <i class="pi pi-barcode text-5xl mb-3"></i>
                <div>สแกนบาร์โค้ดเพื่อเพิ่มสินค้า</div>
            </div>

            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-3 py-2 font-medium w-12">รูป</th>
                            <th class="text-left px-3 py-2 font-medium">รหัส</th>
                            <th class="text-left px-3 py-2 font-medium">ชื่อสินค้า</th>
                            <th class="text-center px-3 py-2 font-medium">หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium w-28">จำนวน</th>
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
                            <td colspan="7" class="px-3 py-2 text-right">ยอดรวม</td>
                            <td class="px-3 py-2 text-right text-primary text-base">{{ formatNumber(totalAmount) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <!-- Action buttons -->
        <div class="flex justify-between">
            <Button label="ยกเลิก" icon="pi pi-arrow-left" severity="secondary" outlined @click="router.back()" />
            <Button label="สร้าง PU" icon="pi pi-check" severity="success" @click="showConfirmDialog = true" :disabled="editItems.length === 0 || isSaving || !selectedWarehouse" />
        </div>

        <!-- Confirm Dialog -->
        <Dialog v-model:visible="showConfirmDialog" modal header="ยืนยันสร้างใบรับสินค้า" :style="{ width: '420px' }" :draggable="false">
            <div class="flex items-start gap-3 py-2">
                <i class="pi pi-question-circle text-3xl text-primary mt-1"></i>
                <div>
                    <div class="font-medium mb-2">ยืนยันการสร้างใบรับสินค้า?</div>
                    <div class="text-sm text-gray-500 mb-1">เลขที่: <span class="font-mono font-medium text-gray-800 dark:text-gray-200">{{ docNo }}</span></div>
                    <div class="text-sm text-gray-500 mb-1">เจ้าหนี้: {{ custCode }}{{ custName ? '~' + custName : '' }}</div>
                    <div class="text-sm text-gray-500 mb-1">คลัง: {{ selectedWarehouse?.name }}{{ selectedShelf ? ' / ' + selectedShelf.name : '' }}</div>
                    <div class="text-sm text-gray-500 mb-1">รายการสินค้า: {{ editItems.length }} รายการ</div>
                    <div class="text-sm font-semibold mt-2">ยอดรวม: ฿{{ formatNumber(totalAmount) }}</div>
                </div>
            </div>
            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showConfirmDialog = false" />
                <Button label="ยืนยันสร้าง PU" icon="pi pi-check" severity="success" @click="createPU" :loading="isSaving" />
            </template>
        </Dialog>
    </div>
</template>
