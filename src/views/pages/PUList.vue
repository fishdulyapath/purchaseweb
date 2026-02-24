<script setup>
import ProductService from '@/services/ProductService';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const apiBase = import.meta.env.VITE_APP_API;
const router = useRouter();
const toast = useToast();

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const pad = (n) => String(n).padStart(2, '0');
const formatDate = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const fromDate = ref(firstOfMonth);
const toDate = ref(today);
const searchText = ref('');
const docs = ref([]);
const isLoading = ref(false);

// Select PO dialog
const showSelectPODialog = ref(false);
const poFromDate = ref(new Date(today.getFullYear(), today.getMonth(), 1));
const poToDate = ref(today);
const poSearch = ref('');
const poDocs = ref([]);
const isLoadingPO = ref(false);
const selectedPOs = ref([]);

async function openSelectPO() {
    selectedPOs.value = [];
    showSelectPODialog.value = true;
    await loadPODocs();
}

function togglePO(po) {
    const idx = selectedPOs.value.indexOf(po);
    if (idx !== -1) {
        selectedPOs.value.splice(idx, 1);
        return;
    }
    // ตรวจว่าเจ้าหนี้ตรงกับที่เลือกไว้แล้ว
    if (selectedPOs.value.length > 0 && selectedPOs.value[0].cust_code !== po.cust_code) {
        toast.add({ severity: 'warn', summary: 'เจ้าหนี้ไม่ตรงกัน', detail: `กรุณาเลือก PO ของเจ้าหนี้ "${selectedPOs.value[0].cust_name}" เท่านั้น`, life: 4000 });
        return;
    }
    selectedPOs.value.push(po);
}

async function loadPODocs() {
    isLoadingPO.value = true;
    try {
        const res = await axios.get(`${apiBase}/getPODocWait`, {
            params: { fromdate: formatDate(poFromDate.value), todate: formatDate(poToDate.value), search: poSearch.value }
        });
        poDocs.value = res.data?.data || [];
    } catch (e) {
        console.error('loadPODocs error:', e);
        poDocs.value = [];
    } finally {
        isLoadingPO.value = false;
    }
}

function proceedCreatePU() {
    if (selectedPOs.value.length === 0) return;
    showSelectPODialog.value = false;
    router.push({ name: 'pu-create', state: { selectedPOs: JSON.stringify(selectedPOs.value) } });
}

// Detail dialog (read-only)
const showDetailDialog = ref(false);
const selectedDoc = ref(null);
const editItems = ref([]);
const isLoadingDetail = ref(false);


async function loadDocs() {
    isLoading.value = true;
    try {
        const res = await axios.get(`${apiBase}/getPUDocList`, {
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
        const res = await axios.get(`${apiBase}/getPUDocDetail`, { params: { doc_no: doc.doc_no } });
        const data = res.data?.data || {};
        editItems.value = (data.items || []).map((item) => ({
            ...item,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0
        }));
        selectedDoc.value = { ...doc, ...data, items: undefined };
    } catch (e) {
        console.error('openDetail error:', e);
    } finally {
        isLoadingDetail.value = false;
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

// Images dialog
const showImagesDialog = ref(false);
const imagesDoc = ref(null);
const imagesList = ref([]);
const isLoadingImages = ref(false);
const isUploadingImage = ref(false);
const isDeletingImage = ref(null); // guid_code ที่กำลังลบ

async function openImages(doc) {
    imagesDoc.value = doc;
    showImagesDialog.value = true;
    await loadImages(doc.doc_no);
}

async function loadImages(docNo) {
    isLoadingImages.value = true;
    try {
        const res = await axios.get(`${apiBase}/getImagesList`, { params: { doc_no: docNo } });
        imagesList.value = res.data?.data || [];
    } catch (e) {
        console.error('loadImages error:', e);
    } finally {
        isLoadingImages.value = false;
    }
}

async function deleteImage(guidCode) {
    isDeletingImage.value = guidCode;
    try {
        await axios.get(`${apiBase}/deleteDocImage`, { params: { guid_code: guidCode } });
        imagesList.value = imagesList.value.filter((i) => i.guid_code !== guidCode);
    } catch (e) {
        console.error('deleteImage error:', e);
    } finally {
        isDeletingImage.value = null;
    }
}

function onFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result;
        isUploadingImage.value = true;
        try {
            await axios.post(`${apiBase}/saveDocImage`, { doc_no: imagesDoc.value.doc_no, image_file: base64 });
            await loadImages(imagesDoc.value.doc_no);
        } catch (err) {
            console.error('uploadImage error:', err);
        } finally {
            isUploadingImage.value = false;
            event.target.value = '';
        }
    };
    reader.readAsDataURL(file);
}

onMounted(() => loadDocs());
</script>

<template>
    <Toast />
    <div class="p-4">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">ใบรับสินค้า (PU)</h2>
            <Button icon="pi pi-plus" label="สร้าง PU" severity="success" @click="openSelectPO" />
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
                        <div v-if="doc.po_doc_list" class="text-sm mb-2"><span class="text-gray-500">เลขที่ PO:</span> {{ doc.po_doc_list }}</div>
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
                            <th class="text-left px-4 py-3 font-medium">เลขที่ PO</th>
                            <th class="text-center px-4 py-3 font-medium">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="doc in docs" :key="doc.doc_no" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-4 py-3 font-medium text-primary">{{ doc.doc_no }}</td>
                            <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ doc.doc_date }} {{ doc.doc_time }}</td>
                            <td class="px-4 py-3">{{ doc.cust_code }}~{{ doc.cust_name }}</td>
                            <td class="px-4 py-3">{{ doc.creator_code }}</td>
                            <td class="px-4 py-3 text-gray-500 text-xs">{{ doc.po_doc_list || '-' }}</td>
                            <td class="px-4 py-3 text-center">
                                <div class="flex gap-1 justify-center">
                                    <Button icon="pi pi-eye" v-tooltip.top="'รายละเอียด'" severity="info" outlined rounded size="small" @click="openDetail(doc)" />
                                    <Button icon="pi pi-image" v-tooltip.top="'รูปภาพเอกสาร'" severity="secondary" outlined rounded size="small" @click="openImages(doc)" />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Detail Dialog (read-only) -->
        <Dialog v-model:visible="showDetailDialog" modal header="รายละเอียดใบรับสินค้า" :style="{ width: '98%', maxWidth: '900px' }" :draggable="false">
            <div v-if="selectedDoc" class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
                <div><span class="text-gray-500">เลขที่:</span> <span class="font-medium">{{ selectedDoc.doc_no }}</span></div>
                <div><span class="text-gray-500">วันที่:</span> {{ selectedDoc.doc_date }} {{ selectedDoc.doc_time }}</div>
                <div><span class="text-gray-500">เจ้าหนี้:</span> {{ selectedDoc.cust_code }}~{{ selectedDoc.cust_name }}</div>
                <div><span class="text-gray-500">ผู้สร้าง:</span> {{ selectedDoc.emp_code }}</div>
                <div>
                    <span class="text-gray-500">ประเภทภาษี:</span>
                    {{ ['ภาษีแยกนอก', 'ภาษีรวมใน', 'ภาษีอัตราศูนย์', 'ไม่กระทบภาษี'][parseInt(selectedDoc.tax_type)] ?? '-' }}
                </div>
                <div v-if="selectedDoc.po_doc_list" class="col-span-2">
                    <span class="text-gray-500">เลขที่ PO:</span> {{ selectedDoc.po_doc_list }}
                </div>
                <div v-if="selectedDoc.remark" class="col-span-2">
                    <span class="text-gray-500">หมายเหตุ:</span> {{ selectedDoc.remark }}
                </div>
            </div>

            <div v-if="isLoadingDetail" class="flex justify-center py-8">
                <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
            </div>

            <div v-else-if="editItems.length === 0" class="text-center text-gray-400 py-6">ไม่พบรายการสินค้า</div>

            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="text-left px-3 py-2 font-medium">เลขที่ PO</th>
                            <th class="text-left px-3 py-2 font-medium w-12">รูป</th>
                            <th class="text-left px-3 py-2 font-medium">รหัส</th>
                            <th class="text-left px-3 py-2 font-medium">ชื่อสินค้า</th>
                            <th class="text-center px-3 py-2 font-medium">หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium w-28">จำนวน</th>
                            <th class="text-right px-3 py-2 font-medium w-32">ราคา/หน่วย</th>
                            <th class="text-right px-3 py-2 font-medium w-32">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, idx) in editItems" :key="idx" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">{{ item.ref_doc_no || '-' }}</td>
                            <td class="px-3 py-2">
                                <div class="w-10 h-10 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                                    <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain" @error="handleImageError" />
                                </div>
                            </td>
                            <td class="px-3 py-2 font-medium">{{ item.item_code }}</td>
                            <td class="px-3 py-2">{{ item.item_name }}</td>
                            <td class="px-3 py-2 text-center">{{ item.unit_code }}</td>
                            <td class="px-3 py-2 text-right">{{ formatNumber(item.qty) }}</td>
                            <td class="px-3 py-2 text-right">{{ formatNumber(item.price) }}</td>
                            <td class="px-3 py-2 text-right font-medium">
                                {{ formatNumber((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)) }}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="text-sm">
                        <tr class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <td colspan="7" class="px-3 py-1.5 text-right text-gray-500">มูลค่าสินค้า</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(selectedDoc?.total_value) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="7" class="px-3 py-1.5 text-right text-gray-500">ส่วนลดท้ายบิล</td>
                            <td class="px-3 py-1.5 text-right text-orange-500">{{ formatNumber(selectedDoc?.total_discount) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="7" class="px-3 py-1.5 text-right text-gray-500">ยอดก่อนภาษี</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(selectedDoc?.total_before_vat) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="7" class="px-3 py-1.5 text-right text-gray-500">ภาษีมูลค่าเพิ่ม</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(selectedDoc?.total_vat_value) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="7" class="px-3 py-1.5 text-right text-gray-500">ยอดหลังภาษี</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(selectedDoc?.total_after_vat) }}</td>
                        </tr>
                        <tr class="bg-gray-50 dark:bg-gray-800">
                            <td colspan="7" class="px-3 py-1.5 text-right text-gray-500">ยกเว้นภาษี</td>
                            <td class="px-3 py-1.5 text-right">{{ formatNumber(selectedDoc?.total_except_vat) }}</td>
                        </tr>
                        <tr class="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-bold">
                            <td colspan="7" class="px-3 py-2 text-right">มูลค่าสุทธิ</td>
                            <td class="px-3 py-2 text-right text-primary text-base">{{ formatNumber(selectedDoc?.total_amount) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <template #footer>
                <Button label="ปิด" icon="pi pi-times" severity="secondary" outlined @click="showDetailDialog = false" />
            </template>
        </Dialog>

        <!-- Select PO Dialog -->
        <Dialog v-model:visible="showSelectPODialog" modal header="เลือกใบสั่งซื้อ (PO) ที่รอรับสินค้า" :style="{ width: '95%', maxWidth: '700px' }" :draggable="false">
            <div class="flex flex-wrap gap-3 items-end mb-4">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">จากวันที่</label>
                    <DatePicker v-model="poFromDate" dateFormat="yy-mm-dd" showIcon class="w-36" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium">ถึงวันที่</label>
                    <DatePicker v-model="poToDate" dateFormat="yy-mm-dd" showIcon class="w-36" />
                </div>
                <div class="flex-1" style="min-width: 140px">
                    <label class="text-sm font-medium block mb-1">ค้นหา</label>
                    <InputText v-model="poSearch" placeholder="เลขที่เอกสาร" class="w-full" @keyup.enter="loadPODocs" />
                </div>
                <Button icon="pi pi-search" label="ค้นหา" size="small" @click="loadPODocs" :loading="isLoadingPO" />
            </div>

            <div v-if="isLoadingPO" class="flex justify-center py-6">
                <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
            </div>
            <div v-else-if="poDocs.length === 0" class="text-center text-gray-400 py-6">ไม่พบใบสั่งซื้อที่รอรับสินค้า</div>
            <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th class="px-3 py-2 w-10"></th>
                            <th class="text-left px-3 py-2 font-medium">เลขที่เอกสาร</th>
                            <th class="text-left px-3 py-2 font-medium">วันที่</th>
                            <th class="text-left px-3 py-2 font-medium">เจ้าหนี้</th>
                            <th class="text-left px-3 py-2 font-medium">ผู้สร้าง</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="po in poDocs" :key="po.doc_no" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td class="px-3 py-2 text-center">
                                <Checkbox :modelValue="selectedPOs.includes(po)" :binary="true" @click.prevent="togglePO(po)" />
                            </td>
                            <td class="px-3 py-2 font-medium text-primary">{{ po.doc_no }}</td>
                            <td class="px-3 py-2 text-gray-500">{{ po.doc_date }} {{ po.doc_time }}</td>
                            <td class="px-3 py-2">{{ po.cust_code }}~{{ po.cust_name }}</td>
                            <td class="px-3 py-2">{{ po.creator_code }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="selectedPOs.length > 0" class="mt-3 p-2 bg-primary-50 dark:bg-primary-900/20 rounded text-sm text-primary">
                เลือกแล้ว {{ selectedPOs.length }} เอกสาร: {{ selectedPOs.map(p => p.doc_no).join(', ') }}
            </div>

            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showSelectPODialog = false" />
                <Button label="ดำเนินการต่อ" icon="pi pi-arrow-right" severity="success" @click="proceedCreatePU" :disabled="selectedPOs.length === 0" />
            </template>
        </Dialog>

        <!-- Images Dialog -->
        <Dialog v-model:visible="showImagesDialog" modal :header="`รูปภาพเอกสาร - ${imagesDoc?.doc_no}`" :style="{ width: '95%', maxWidth: '800px' }" :draggable="false">
            <div v-if="isLoadingImages" class="flex justify-center py-8">
                <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
            </div>

            <div v-else>
                <!-- Upload button -->
                <div class="mb-4">
                    <label class="cursor-pointer">
                        <Button
                            icon="pi pi-upload"
                            label="อัพโหลดรูป"
                            severity="success"
                            :loading="isUploadingImage"
                            @click="$refs.fileInput.click()"
                        />
                        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileSelected" />
                    </label>
                </div>

                <!-- Images grid -->
                <div v-if="imagesList.length === 0" class="text-center text-gray-400 py-8">
                    <i class="pi pi-image text-4xl mb-2 block"></i>
                    ไม่มีรูปภาพ
                </div>
                <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div v-for="img in imagesList" :key="img.guid_code" class="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <img
                            :src="`${apiBase}/getDocImage/${img.guid_code}`"
                            class="w-full  object-contain bg-white dark:bg-gray-900"
                            @error="(e) => e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg'"
                        />
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                                icon="pi pi-trash"
                                severity="danger"
                                rounded
                                :loading="isDeletingImage === img.guid_code"
                                @click="deleteImage(img.guid_code)"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="ปิด" icon="pi pi-times" severity="secondary" outlined @click="showImagesDialog = false" />
            </template>
        </Dialog>
    </div>
</template>
