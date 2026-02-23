<script setup>
import ProductService from '@/services/ProductService';
import axios from 'axios';
import { onMounted, ref } from 'vue';

const apiBase = import.meta.env.VITE_APP_API;

// Filter state
const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const formatDate = (d) => d.toISOString().slice(0, 10);

const fromDate = ref(firstOfMonth);
const toDate = ref(today);
const searchText = ref('');

// List state
const docs = ref([]);
const isLoading = ref(false);

// Detail dialog
const showDetailDialog = ref(false);
const selectedDoc = ref(null);
const detailItems = ref([]);
const isLoadingDetail = ref(false);

// Approve/Reject dialog
const showActionDialog = ref(false);
const actionType = ref(''); // 'approve' | 'reject'
const actionDocNo = ref('');
const approverName = ref('');
const isSubmitting = ref(false);

async function loadDocs() {
    isLoading.value = true;
    try {
        const from = formatDate(fromDate.value instanceof Date ? fromDate.value : new Date(fromDate.value));
        const to = formatDate(toDate.value instanceof Date ? toDate.value : new Date(toDate.value));
        const res = await axios.get(`${apiBase}/getPRDocWaitApprove`, {
            params: { fromdate: from, todate: to, search: searchText.value }
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

function openApproveDialog(doc) {
    actionDocNo.value = doc.doc_no;
    actionType.value = 'approve';
    approverName.value = '';
    showActionDialog.value = true;
}

function openRejectDialog(doc) {
    actionDocNo.value = doc.doc_no;
    actionType.value = 'reject';
    approverName.value = '';
    showActionDialog.value = true;
}
function generateOrderNumber() {
    // Get current date in yyyymmdd format
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Generate a simple GUID-like string (3 letters followed by 2 digits)
    // You can modify this part based on your specific GUID requirements
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let guid = '';

    // Generate 3 random uppercase letters
    for (let i = 0; i < 3; i++) {
        guid += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    // Add 2 random digits
    guid += Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, '0');

    // Return the final order number in the format MPAyyyymmdd-guid
    return `MPRA${dateStr}-${guid}`;
}

async function submitAction() {
    if (!approverName.value.trim()) return;
    isSubmitting.value = true;
    var doc_no = generateOrderNumber();
    try {
        const endpoint = actionType.value === 'approve' ? '/sendApprove' : '/cancelApprove';
        await axios.get(`${apiBase}${endpoint}`, {
            params: { docno: doc_no, docref: actionDocNo.value, empcode: approverName.value.trim() }
        });
        showActionDialog.value = false;
        await loadDocs();
    } catch (e) {
        console.error('submitAction error:', e);
    } finally {
        isSubmitting.value = false;
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
    loadDocs();
});
</script>

<template>
    <div class="p-4">
        <h2 class="text-xl font-bold mb-4">อนุมัติเสนอซื้อ (PR)</h2>

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
                    <InputText v-model="searchText" placeholder="ค้นหา" class="w-full" @keyup.enter="loadDocs" />
                </div>
                <Button icon="pi pi-search" label="ค้นหา" @click="loadDocs" :loading="isLoading" />
            </div>
        </div>

        <!-- Document list -->
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <div v-if="isLoading" class="flex justify-center items-center py-12">
                <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
            </div>

            <div v-else-if="docs.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-400">
                <i class="pi pi-file text-5xl mb-3"></i>
                <div>ไม่พบเอกสารรอการอนุมัติ</div>
            </div>

            <div v-else>
                <!-- Mobile card list -->
                <div class="block sm:hidden">
                    <div v-for="doc in docs" :key="doc.doc_no" class="border-b border-gray-100 dark:border-gray-800 p-4">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-semibold text-primary">{{ doc.doc_no }}</div>
                                <div class="text-sm text-gray-500">{{ doc.doc_date }} {{ doc.doc_time }}</div>
                            </div>
                        </div>
                        <div class="text-sm mb-1"><span class="text-gray-500">เจ้าหนี้:</span> {{ doc.cust_code }}~{{ doc.cust_name }}</div>
                        <div v-if="doc.remark" class="text-sm mb-3"><span class="text-gray-500">หมายเหตุ:</span> {{ doc.remark }}</div>
                        <div class="flex gap-2 mt-2">
                            <Button icon="pi pi-list" label="รายละเอียด" severity="info" outlined size="small" @click="openDetail(doc)" class="flex-1" />
                            <Button icon="pi pi-check" label="อนุมัติ" severity="success" size="small" @click="openApproveDialog(doc)" class="flex-1" />
                            <Button icon="pi pi-times" label="ไม่อนุมัติ" severity="danger" outlined size="small" @click="openRejectDialog(doc)" class="flex-1" />
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
                            <th class="text-left px-4 py-3 font-medium">หมายเหตุ</th>
                            <th class="text-center px-4 py-3 font-medium">การจัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="doc in docs" :key="doc.doc_no" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-4 py-3 font-medium text-primary">{{ doc.doc_no }}</td>
                            <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ doc.doc_date }} {{ doc.doc_time }}</td>
                            <td class="px-4 py-3">{{ doc.cust_code }}~{{ doc.cust_name }}</td>
                            <td class="px-4 py-3 text-gray-500">{{ doc.remark || '-' }}</td>
                            <td class="px-4 py-3">
                                <div class="flex gap-2 justify-center">
                                    <Button icon="pi pi-list" v-tooltip.top="'รายละเอียด'" severity="info" outlined rounded size="small" @click="openDetail(doc)" />
                                    <Button icon="pi pi-check" v-tooltip.top="'อนุมัติ'" severity="success" rounded size="small" @click="openApproveDialog(doc)" />
                                    <Button icon="pi pi-times" v-tooltip.top="'ไม่อนุมัติ'" severity="danger" outlined rounded size="small" @click="openRejectDialog(doc)" />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Detail Dialog -->
        <Dialog v-model:visible="showDetailDialog" modal header="รายละเอียดเอกสาร" :style="{ width: '95%', maxWidth: '800px' }" :closable="true" :draggable="false">
            <div v-if="selectedDoc" class="mb-3">
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
                    <div>
                        <span class="text-gray-500">เลขที่:</span> <span class="font-medium">{{ selectedDoc.doc_no }}</span>
                    </div>
                    <div><span class="text-gray-500">วันที่:</span> {{ selectedDoc.doc_date }} {{ selectedDoc.doc_time }}</div>
                    <div><span class="text-gray-500">เจ้าหนี้:</span> {{ selectedDoc.cust_code }}~{{ selectedDoc.cust_name }}</div>
                    <div v-if="selectedDoc.remark"><span class="text-gray-500">หมายเหตุ:</span> {{ selectedDoc.remark }}</div>
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
                <Button
                    icon="pi pi-check"
                    label="อนุมัติ"
                    severity="success"
                    @click="
                        showDetailDialog = false;
                        openApproveDialog(selectedDoc);
                    "
                />
                <Button
                    icon="pi pi-times"
                    label="ไม่อนุมัติ"
                    severity="danger"
                    outlined
                    @click="
                        showDetailDialog = false;
                        openRejectDialog(selectedDoc);
                    "
                />
            </template>
        </Dialog>

        <!-- Approve / Reject Action Dialog -->
        <Dialog v-model:visible="showActionDialog" modal :header="actionType === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการไม่อนุมัติ'" :style="{ width: '380px' }" :closable="!isSubmitting">
            <div class="flex items-start gap-3 mb-4">
                <i :class="['text-3xl mt-1', actionType === 'approve' ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-red-500']"></i>
                <div>
                    <div class="font-medium mb-1">
                        {{ actionType === 'approve' ? 'อนุมัติเอกสาร' : 'ไม่อนุมัติเอกสาร' }}
                    </div>
                    <div class="text-sm text-gray-500">{{ actionDocNo }}</div>
                </div>
            </div>

            <div class="flex flex-col gap-1">
                <label class="font-medium text-sm">ชื่อผู้อนุมัติ <span class="text-red-500">*</span></label>
                <InputText v-model="approverName" placeholder="กรอกชื่อหรือรหัสผู้อนุมัติ" class="w-full" @keyup.enter="submitAction" />
            </div>

            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showActionDialog = false" :disabled="isSubmitting" />
                <Button
                    :label="actionType === 'approve' ? 'ยืนยันอนุมัติ' : 'ยืนยันไม่อนุมัติ'"
                    :icon="actionType === 'approve' ? 'pi pi-check' : 'pi pi-times'"
                    :severity="actionType === 'approve' ? 'success' : 'danger'"
                    @click="submitAction"
                    :loading="isSubmitting"
                    :disabled="!approverName.trim()"
                />
            </template>
        </Dialog>
    </div>
</template>
