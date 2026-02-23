<script setup>
import ProductService from '@/services/ProductService';
import { useCartStore } from '@/stores/cartStore';
import axios from 'axios';
import { onMounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';

const apiBase = import.meta.env.VITE_APP_API;
const cartStore = useCartStore();
const toast = useToast();

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const formatDate = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

const fromDate = ref(firstOfMonth);
const toDate = ref(today);
const searchText = ref('');

const docs = ref([]);
const isLoading = ref(false);

const showDetailDialog = ref(false);
const selectedDoc = ref(null);
const detailItems = ref([]);
const isLoadingDetail = ref(false);

const statusLabel = (code) => {
    if (code === '1') return { text: 'อนุมัติแล้ว', severity: 'success' };
    if (code === '2') return { text: 'ไม่อนุมัติ', severity: 'danger' };
    return { text: 'รออนุมัติ', severity: 'warn' };
};

async function loadDocs() {
    isLoading.value = true;
    try {
        const res = await axios.get(`${apiBase}/getPRDocList`, {
            params: { fromdate: formatDate(fromDate.value), todate: formatDate(toDate.value), search: searchText.value }
        });
        docs.value = res.data?.data || [];
    } catch (e) {
        console.error('loadDocs error:', e);
        docs.value = [];
    } finally {
        isLoading.value = false;
    }
}

async function openDetail(doc) {
    selectedDoc.value = doc;
    detailItems.value = [];
    showDetailDialog.value = true;
    isLoadingDetail.value = true;
    try {
        const res = await axios.get(`${apiBase}/getDocDetail`, { params: { doc_no: doc.doc_no } });
        detailItems.value = res.data?.data?.items || [];
    } catch (e) {
        console.error('openDetail error:', e);
    } finally {
        isLoadingDetail.value = false;
    }
}

function formatDateTime(value) {
    if (!value) return '-';
    // "2026-02-23 09:58:23.900397+07" → "2026-02-23 09:58"
    return value.replace('T', ' ').slice(0, 16);
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

const isReordering = ref(false);

async function reorder(doc) {
    isReordering.value = true;
    try {
        const res = await axios.get(`${apiBase}/getDocDetail`, { params: { doc_no: doc.doc_no } });
        const items = res.data?.data?.items || [];
        if (items.length === 0) {
            toast.add({ severity: 'warn', summary: 'ไม่พบรายการสินค้า', life: 3000 });
            return;
        }
        const cartItems = items.map((item) => ({
            item_code: item.item_code,
            item_name: item.item_name,
            unit_code: item.unit_code,
            qty: parseInt(item.qty) || 1,
            price: parseFloat(item.price) || 0,
            wh_code: item.wh_code || '',
            shelf_code: item.shelf_code || '',
            barcode: item.barcode || ''
        }));
        await cartStore.addMultipleToCart(cartItems);
        toast.add({ severity: 'success', summary: 'เพิ่มสินค้าเข้าตะกร้าแล้ว', detail: `${cartItems.length} รายการจาก ${doc.doc_no}`, life: 3000 });
    } catch (e) {
        console.error('reorder error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถเพิ่มสินค้าเข้าตะกร้าได้', life: 3000 });
    } finally {
        isReordering.value = false;
    }
}

onMounted(() => loadDocs());
</script>

<template>
    <Toast />
    <div class="p-4">
        <h2 class="text-xl font-bold mb-4">ประวัติเสนอซื้อ (PR)</h2>

        <!-- Filter bar -->
        <div class="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 shadow-sm">
            <div class="flex flex-wrap gap-3 items-end">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">จากวันที่</label>
                    <DatePicker v-model="fromDate" dateFormat="yy-mm-dd" showIcon class="w-40" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">ถึงวันที่</label>
                    <DatePicker v-model="toDate" dateFormat="yy-mm-dd" showIcon class="w-40" />
                </div>
                <div class="flex flex-col gap-1 flex-1" style="min-width: 160px">
                    <label class="text-sm font-medium">ค้นหา</label>
                    <InputText v-model="searchText" placeholder="เลขที่เอกสาร / รหัสร้าน" class="w-full" @keyup.enter="loadDocs" />
                </div>
                <Button icon="pi pi-search" label="ค้นหา" @click="loadDocs" :loading="isLoading" />
            </div>
        </div>

        <!-- List -->
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <div v-if="isLoading" class="flex justify-center items-center py-12">
                <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
            </div>

            <div v-else-if="docs.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-400">
                <i class="pi pi-file text-5xl mb-3"></i>
                <div>ไม่พบเอกสาร</div>
            </div>

            <div v-else>
                <!-- Mobile card -->
                <div class="block sm:hidden">
                    <div v-for="doc in docs" :key="doc.doc_no" class="border-b border-gray-100 dark:border-gray-800 p-4">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-semibold text-primary">{{ doc.doc_no }}</div>
                                <div class="text-sm text-gray-500">{{ doc.doc_date }} {{ doc.doc_time }}</div>
                            </div>
                            <Tag :value="statusLabel(doc.approve_status).text" :severity="statusLabel(doc.approve_status).severity" />
                        </div>
                        <div class="text-sm mb-1"><span class="text-gray-500">เจ้าหนี้:</span> {{ doc.cust_code }}</div>
                        <div class="text-sm mb-1"><span class="text-gray-500">ผู้เสนอ:</span> {{ doc.user_request }}</div>
                        <div class="text-sm mb-1"><span class="text-gray-500">ผู้อนุมัติ:</span> {{ doc.approve_code || '-' }}</div>
                        <div v-if="doc.doc_ref" class="text-sm mb-1"><span class="text-gray-500">เลขที่อนุมัติ:</span> {{ doc.doc_ref }}</div>
                        <div v-if="doc.approve_datetime" class="text-sm mb-1"><span class="text-gray-500">วันที่อนุมัติ:</span> {{ formatDateTime(doc.approve_datetime) }}</div>
                        <div v-if="doc.remark" class="text-sm mb-3"><span class="text-gray-500">หมายเหตุ:</span> {{ doc.remark }}</div>
                        <div class="flex gap-2 mt-2">
                            <Button icon="pi pi-list" label="รายละเอียด" severity="info" outlined size="small" class="flex-1" @click="openDetail(doc)" />
                            <Button icon="pi pi-replay" label="สั่งอีกครั้ง" severity="warning" size="small" class="flex-1" @click="reorder(doc)" :loading="isReordering" />
                        </div>
                    </div>
                </div>

                <!-- Desktop table -->
                <table class="hidden sm:table w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-4 py-3 font-medium">เลขที่เอกสาร</th>
                            <th class="text-left px-4 py-3 font-medium">วันที่</th>
                            <th class="text-left px-4 py-3 font-medium">เจ้าหนี้</th>
                            <th class="text-left px-4 py-3 font-medium">ผู้เสนอ</th>
                            <th class="text-left px-4 py-3 font-medium">ผู้อนุมัติ</th>
                            <th class="text-left px-4 py-3 font-medium">เลขที่อนุมัติ</th>
                            <th class="text-left px-4 py-3 font-medium">วันที่อนุมัติ</th>
                            <th class="text-left px-4 py-3 font-medium">หมายเหตุ</th>
                            <th class="text-center px-4 py-3 font-medium">สถานะ</th>
                            <th class="text-center px-4 py-3 font-medium">การจัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="doc in docs" :key="doc.doc_no" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-4 py-3 font-medium text-primary">{{ doc.doc_no }}</td>
                            <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ doc.doc_date }} {{ doc.doc_time }}</td>
                            <td class="px-4 py-3">{{ doc.cust_code }}</td>
                            <td class="px-4 py-3">{{ doc.user_request }}</td>
                            <td class="px-4 py-3">{{ doc.approve_code || '-' }}</td>
                            <td class="px-4 py-3 text-gray-500">{{ doc.doc_ref || '-' }}</td>
                            <td class="px-4 py-3 text-gray-500">{{ formatDateTime(doc.approve_datetime) }}</td>
                            <td class="px-4 py-3 text-gray-500">{{ doc.remark || '-' }}</td>
                            <td class="px-4 py-3 text-center">
                                <Tag :value="statusLabel(doc.approve_status).text" :severity="statusLabel(doc.approve_status).severity" />
                            </td>
                            <td class="px-4 py-3 text-center">
                                <div class="flex gap-2 justify-center">
                                    <Button icon="pi pi-list" v-tooltip.top="'รายละเอียด'" severity="info" outlined rounded size="small" @click="openDetail(doc)" />
                                    <Button icon="pi pi-replay" v-tooltip.top="'สั่งอีกครั้ง'" severity="warning" rounded size="small" @click="reorder(doc)" :loading="isReordering" />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Detail Dialog -->
        <Dialog v-model:visible="showDetailDialog" modal header="รายละเอียดเอกสาร" :style="{ width: '95%', maxWidth: '800px' }" :draggable="false">
            <div v-if="selectedDoc" class="mb-4">
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                    <div><span class="text-gray-500">เลขที่:</span> <span class="font-medium">{{ selectedDoc.doc_no }}</span></div>
                    <div><span class="text-gray-500">วันที่:</span> {{ selectedDoc.doc_date }} {{ selectedDoc.doc_time }}</div>
                    <div><span class="text-gray-500">เจ้าหนี้:</span> {{ selectedDoc.cust_code }}</div>
                    <div><span class="text-gray-500">ผู้เสนอ:</span> {{ selectedDoc.user_request }}</div>
                    <div><span class="text-gray-500">ผู้อนุมัติ:</span> {{ selectedDoc.approve_code || '-' }}</div>
                    <div><span class="text-gray-500">สถานะ:</span> <Tag :value="statusLabel(selectedDoc.approve_status).text" :severity="statusLabel(selectedDoc.approve_status).severity" class="ml-1" /></div>
                    <div v-if="selectedDoc.doc_ref"><span class="text-gray-500">เลขที่อนุมัติ:</span> <span class="font-medium">{{ selectedDoc.doc_ref }}</span></div>
                    <div v-if="selectedDoc.approve_datetime"><span class="text-gray-500">วันที่อนุมัติ:</span> {{ formatDateTime(selectedDoc.approve_datetime) }}</div>
                    <div v-if="selectedDoc.remark" class="col-span-2"><span class="text-gray-500">หมายเหตุ:</span> {{ selectedDoc.remark }}</div>
                </div>
            </div>

            <div v-if="isLoadingDetail" class="flex justify-center py-8">
                <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
            </div>

            <div v-else-if="detailItems.length === 0" class="text-center text-gray-400 py-6">ไม่พบรายการสินค้า</div>

            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-3 py-2 font-medium">รูป</th>
                            <th class="text-left px-3 py-2 font-medium">รหัส</th>
                            <th class="text-left px-3 py-2 font-medium">ชื่อสินค้า</th>
                            <th class="text-center px-3 py-2 font-medium">หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium">จำนวน</th>
                            <th class="text-right px-3 py-2 font-medium">ต่ำสุด</th>
                            <th class="text-right px-3 py-2 font-medium">สูงสุด</th>
                            <th class="text-right px-3 py-2 font-medium">ราคา</th>
                            <th class="text-right px-3 py-2 font-medium">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in detailItems" :key="idx" class="border-t border-gray-100 dark:border-gray-800">
                            <td class="px-3 py-2">
                                <div class="w-10 h-10 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                                    <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain" @error="handleImageError" />
                                </div>
                            </td>
                            <td class="px-3 py-2 font-medium">{{ item.item_code }}</td>
                            <td class="px-3 py-2">{{ item.item_name }}</td>
                            <td class="px-3 py-2 text-center">{{ item.unit_code }}</td>
                            <td class="px-3 py-2 text-right">{{ item.qty }}</td>
                            <td class="px-3 py-2 text-right text-gray-500">{{ item.minimum_qty }}</td>
                            <td class="px-3 py-2 text-right text-gray-500">{{ item.maximum_qty }}</td>
                            <td class="px-3 py-2 text-right">{{ formatNumber(item.price) }}</td>
                            <td class="px-3 py-2 text-right font-medium">{{ formatNumber(item.sum_amount) }}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                            <td colspan="8" class="px-3 py-2 text-right">ยอดรวม</td>
                            <td class="px-3 py-2 text-right text-primary">{{ formatNumber(detailItems.reduce((s, i) => s + parseFloat(i.sum_amount || 0), 0)) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <template #footer>
                <Button label="ปิด" icon="pi pi-times" severity="secondary" outlined @click="showDetailDialog = false" />
            </template>
        </Dialog>
    </div>
</template>
