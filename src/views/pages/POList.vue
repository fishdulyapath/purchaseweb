<script setup>
import ProductService from '@/services/ProductService';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const apiBase = import.meta.env.VITE_APP_API;
const toast = useToast();
const router = useRouter();

// Select PR dialog
const showSelectPRDialog = ref(false);
const prFromDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const prToDate = ref(new Date());
const prSearch = ref('');
const prDocs = ref([]);
const isLoadingPR = ref(false);
const selectedPRs = ref([]);

async function openSelectPR() {
    selectedPRs.value = [];
    showSelectPRDialog.value = true;
    await loadPRDocs();
}

async function loadPRDocs() {
    isLoadingPR.value = true;
    try {
        const from = formatDate(prFromDate.value);
        const to = formatDate(prToDate.value);
        const res = await axios.get(`${apiBase}/getPRDocApproved`, {
            params: { fromdate: from, todate: to, search: prSearch.value }
        });
        prDocs.value = res.data?.data || [];
    } catch (e) {
        console.error('loadPRDocs error:', e);
        prDocs.value = [];
    } finally {
        isLoadingPR.value = false;
    }
}

function proceedCreatePO() {
    if (selectedPRs.value.length === 0) return;
    showSelectPRDialog.value = false;
    router.push({ name: 'po-create', state: { selectedPRs: JSON.stringify(selectedPRs.value) } });
}

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const formatDate = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

const fromDate = ref(firstOfMonth);
const toDate = ref(today);
const searchText = ref('');

const docs = ref([]);
const isLoading = ref(false);

// Detail dialog
const showDetailDialog = ref(false);
const selectedDoc = ref(null);
const editItems = ref([]);
const isLoadingDetail = ref(false);
const isSaving = ref(false);

async function loadDocs() {
    isLoading.value = true;
    try {
        const res = await axios.get(`${apiBase}/getPODocList`, {
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
    editItems.value = [];
    showDetailDialog.value = true;
    isLoadingDetail.value = true;
    try {
        const res = await axios.get(`${apiBase}/getDocPoDetail`, { params: { doc_no: doc.doc_no } });
        const data = res.data?.data || {};
        editItems.value = (data.items || []).map((item) => ({
            ...item,
            price: parseFloat(item.price) || 0,
            po_qty: parseFloat(item.po_qty) || 0,
            pu_qty: parseFloat(item.pu_qty) || 0,
            balance_qty: parseFloat(item.balance_qty) || 0,
            updateable: item.updateable === '1' || item.updateable === 1
        }));
        selectedDoc.value = { ...doc, ...data, items: undefined };
    } catch (e) {
        console.error('openDetail error:', e);
    } finally {
        isLoadingDetail.value = false;
    }
}

async function saveDetail() {
    if (!selectedDoc.value) return;
    isSaving.value = true;
    try {
        const empCode = localStorage.getItem('_empCode') || '';
        const payload = editItems.value.map((item) => ({
                doc_no: selectedDoc.value.doc_no,
                doc_date: selectedDoc.value.doc_date,
                doc_time: selectedDoc.value.doc_time,
                cust_code: selectedDoc.value.cust_code,
                emp_code: empCode,
                item_code: item.item_code,
                item_name: item.item_name,
                unit_code: item.unit_code,
                barcode: item.barcode || '',
                qty: String(item.po_qty),
                price: String(item.price),
                stand_value: item.stand_value || '1',
                divide_value: item.divide_value || '1',
                ratio: item.ratio || '1'
            }));
        await axios.post(`${apiBase}/updatePoDetail`, payload, {
            params: { docno: selectedDoc.value.doc_no }
        });
        toast.add({ severity: 'success', summary: 'บันทึกสำเร็จ', detail: `อัปเดต ${selectedDoc.value.doc_no} แล้ว`, life: 3000 });
        showDetailDialog.value = false;
    } catch (e) {
        console.error('saveDetail error:', e);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถบันทึกได้', life: 3000 });
    } finally {
        isSaving.value = false;
    }
}

const totalAmount = computed(() => editItems.value.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.po_qty) || 0), 0));

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

onMounted(() => loadDocs());
</script>

<template>
    <Toast />
    <div class="p-4">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">ใบสั่งซื้อ (PO)</h2>
            <Button icon="pi pi-plus" label="สร้าง PO" severity="success" @click="openSelectPR" />
        </div>

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
                        <div class="font-semibold text-primary mb-1">{{ doc.doc_no }}</div>
                        <div class="text-sm text-gray-500 mb-1">{{ doc.doc_date }} {{ doc.doc_time }}</div>
                        <div class="text-sm mb-1"><span class="text-gray-500">เจ้าหนี้:</span> {{ doc.cust_code }}~{{ doc.cust_name }}</div>
                        <div class="text-sm mb-1"><span class="text-gray-500">ผู้สร้าง:</span> {{ doc.creator_code }}</div>
                        <div v-if="doc.pra_doc_list" class="text-sm mb-2"><span class="text-gray-500">เลขที่อนุมัติ:</span> {{ doc.pra_doc_list }}</div>
                        <Button icon="pi pi-pencil" label="รายละเอียด/แก้ไข" severity="info" outlined size="small" class="w-full" @click="openDetail(doc)" />
                    </div>
                </div>

                <!-- Desktop table -->
                <table class="hidden sm:table w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-4 py-3 font-medium">เลขที่เอกสาร</th>
                            <th class="text-left px-4 py-3 font-medium">วันที่</th>
                            <th class="text-left px-4 py-3 font-medium">เจ้าหนี้</th>
                            <th class="text-left px-4 py-3 font-medium">ผู้สร้าง</th>
                            <th class="text-left px-4 py-3 font-medium">เลขที่อนุมัติ PR</th>
                            <th class="text-center px-4 py-3 font-medium">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="doc in docs" :key="doc.doc_no" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-4 py-3 font-medium text-primary">{{ doc.doc_no }}</td>
                            <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ doc.doc_date }} {{ doc.doc_time }}</td>
                            <td class="px-4 py-3">{{ doc.cust_code }}~{{ doc.cust_name }}</td>
                            <td class="px-4 py-3">{{ doc.creator_code }}</td>
                            <td class="px-4 py-3 text-gray-500 text-xs">{{ doc.pra_doc_list || '-' }}</td>
                            <td class="px-4 py-3 text-center">
                                <Button icon="pi pi-pencil" v-tooltip.top="'รายละเอียด/แก้ไข'" severity="info" outlined rounded size="small" @click="openDetail(doc)" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Detail / Edit Dialog -->
        <Dialog v-model:visible="showDetailDialog" modal header="รายละเอียดใบสั่งซื้อ" :style="{ width: '98%', maxWidth: '1000px' }" :draggable="false" :closable="!isSaving">
            <div v-if="selectedDoc" class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
                <div>
                    <span class="text-gray-500">เลขที่:</span> <span class="font-medium">{{ selectedDoc.doc_no }}</span>
                </div>
                <div><span class="text-gray-500">วันที่:</span> {{ selectedDoc.doc_date }} {{ selectedDoc.doc_time }}</div>
                <div><span class="text-gray-500">เจ้าหนี้:</span> {{ selectedDoc.cust_code }}~{{ selectedDoc.cust_name }}</div>
                <div><span class="text-gray-500">ผู้สร้าง:</span> {{ selectedDoc.creator_code }}</div>
                <div v-if="selectedDoc.pra_doc_list" class="col-span-2"><span class="text-gray-500">เลขที่อนุมัติ PR:</span> {{ selectedDoc.pra_doc_list }}</div>
            </div>

            <div v-if="isLoadingDetail" class="flex justify-center py-8">
                <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
            </div>

            <div v-else-if="editItems.length === 0" class="text-center text-gray-400 py-6">ไม่พบรายการสินค้า</div>

            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-3 py-2 font-medium w-12">รูป</th>
                            <th class="text-left px-3 py-2 font-medium">รหัส</th>
                            <th class="text-left px-3 py-2 font-medium">ชื่อสินค้า</th>
                            <th class="text-center px-3 py-2 font-medium">หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium w-24">สั่ง</th>
                            <th class="text-right px-3 py-2 font-medium w-24">รับแล้ว</th>
                            <th class="text-right px-3 py-2 font-medium w-24">ค้างรับ</th>
                            <th class="text-right px-3 py-2 font-medium w-28">ราคา/หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium w-28">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in editItems" :key="idx" class="border-t border-gray-100 dark:border-gray-800" :class="item.updateable ? 'bg-gray-50 dark:bg-gray-800/30 opacity-60' : ''">
                            <td class="px-3 py-2">
                                <div class="w-10 h-10 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                                    <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain" @error="handleImageError" />
                                </div>
                            </td>
                            <td class="px-3 py-2 font-medium">{{ item.item_code }}</td>
                            <td class="px-3 py-2">
                                <div>{{ item.item_name }}</div>
                                <div v-if="item.updateable" class="text-xs text-orange-500 font-medium">รับครบแล้ว</div>
                            </td>
                            <td class="px-3 py-2 text-center">{{ item.unit_code }}</td>
                            <td class="px-3 py-2">
                                <InputNumber v-model="item.po_qty" :min="0" :maxFractionDigits="2" class="w-full" inputClass="text-right" :disabled="item.updateable" />
                            </td>
                            <td class="px-3 py-2 text-right text-blue-600 dark:text-blue-400">{{ formatNumber(item.pu_qty) }}</td>
                            <td class="px-3 py-2 text-right font-medium" :class="item.balance_qty > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                                {{ formatNumber(item.balance_qty) }}
                            </td>
                            <td class="px-3 py-2">
                                <InputNumber v-model="item.price" :min="0" :maxFractionDigits="2" class="w-full" inputClass="text-right" :disabled="item.updateable" />
                            </td>
                            <td class="px-3 py-2 text-right font-medium">
                                {{ formatNumber((parseFloat(item.price) || 0) * (parseFloat(item.po_qty) || 0)) }}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr class="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                            <td colspan="8" class="px-3 py-2 text-right">ยอดรวม</td>
                            <td class="px-3 py-2 text-right text-primary">{{ formatNumber(totalAmount) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showDetailDialog = false" :disabled="isSaving" />
                <Button v-if="selectedDoc?.doc_success !== '1' && selectedDoc?.doc_success !== 1" label="บันทึก" icon="pi pi-save" severity="success" @click="saveDetail" :loading="isSaving" :disabled="editItems.length === 0" />
            </template>
        </Dialog>
        <!-- Select PR Dialog -->
        <Dialog v-model:visible="showSelectPRDialog" modal header="เลือกเอกสาร PR ที่อนุมัติแล้ว" :style="{ width: '95%', maxWidth: '700px' }" :draggable="false">
            <!-- Filter -->
            <div class="flex flex-wrap gap-3 items-end mb-4">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">จากวันที่</label>
                    <DatePicker v-model="prFromDate" dateFormat="yy-mm-dd" showIcon class="w-36" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">ถึงวันที่</label>
                    <DatePicker v-model="prToDate" dateFormat="yy-mm-dd" showIcon class="w-36" />
                </div>
                <div class="flex-1" style="min-width: 140px">
                    <label class="text-sm font-medium block mb-1">ค้นหา</label>
                    <InputText v-model="prSearch" placeholder="เลขที่เอกสาร" class="w-full" @keyup.enter="loadPRDocs" />
                </div>
                <Button icon="pi pi-search" label="ค้นหา" size="small" @click="loadPRDocs" :loading="isLoadingPR" />
            </div>

            <div v-if="isLoadingPR" class="flex justify-center py-6">
                <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
            </div>
            <div v-else-if="prDocs.length === 0" class="text-center text-gray-400 py-6">ไม่พบเอกสาร PR ที่อนุมัติแล้ว</div>
            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="px-3 py-2 w-10"></th>
                            <th class="text-left px-3 py-2 font-medium">เลขที่เอกสาร</th>
                            <th class="text-left px-3 py-2 font-medium">วันที่</th>
                            <th class="text-left px-3 py-2 font-medium">เจ้าหนี้</th>
                            <th class="text-left px-3 py-2 font-medium">ผู้อนุมัติ</th>
                            <th class="text-left px-3 py-2 font-medium">หมายเหตุ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="pr in prDocs" :key="pr.doc_no" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-3 py-2 text-center">
                                <Checkbox :modelValue="selectedPRs.includes(pr)" :binary="true" @change="selectedPRs.includes(pr) ? selectedPRs.splice(selectedPRs.indexOf(pr), 1) : selectedPRs.push(pr)" />
                            </td>
                            <td class="px-3 py-2 font-medium text-primary">{{ pr.doc_no }}</td>
                            <td class="px-3 py-2 text-gray-500">{{ pr.doc_date }} {{ pr.doc_time }}</td>
                            <td class="px-3 py-2">{{ pr.cust_code }}~{{ pr.cust_name }}</td>
                            <td class="px-3 py-2">{{ pr.approve_code }}</td>
                            <td class="px-3 py-2 text-gray-500">{{ pr.remark || '-' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="selectedPRs.length > 0" class="mt-3 p-2 bg-primary-50 dark:bg-primary-900/20 rounded text-sm text-primary">เลือกแล้ว {{ selectedPRs.length }} เอกสาร: {{ selectedPRs.map((p) => p.doc_no).join(', ') }}</div>

            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showSelectPRDialog = false" />
                <Button label="ดำเนินการต่อ" icon="pi pi-arrow-right" severity="success" @click="proceedCreatePO" :disabled="selectedPRs.length === 0" />
            </template>
        </Dialog>
    </div>
</template>
