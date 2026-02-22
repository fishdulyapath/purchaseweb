<script setup>
import SupplierService from '@/services/SupplierService';
import { useAuthenStore } from '@/stores/authen';
import WarehouseService from '@/services/WarehouseList';
import { onMounted, ref } from 'vue';

const authenStore = useAuthenStore();

// ตัวแปรสถานะ
const isEmployee = ref(false);
const employeeData = ref(null);
const userData = ref(null);
const storeName = ref('');

const warehouseName = ref('');
const warehouseCode = ref('');

// ตัวแปรสำหรับเปลี่ยนคลัง
const showWarehouseDialog = ref(false);
const selectedWarehouse = ref(null);
const warehouseOptions = ref([]);
const allWarehouseOptions = ref([]);
const isLoadingWarehouses = ref(false);

// ตัวแปรสำหรับเปลี่ยนเจ้าหนี้
const showSupplierDialog = ref(false);
const selectedSupplier = ref(null);
const supplierOptions = ref([]);
const isSearchingSupplier = ref(false);
let supplierSearchTimer = null;

// ฟังก์ชันเปิด dialog เปลี่ยนเจ้าหนี้
const openChangeSupplierDialog = async () => {
    selectedSupplier.value = null;
    supplierOptions.value = [];
    showSupplierDialog.value = true;
    try {
        isSearchingSupplier.value = true;
        const data = await SupplierService.getSuppliers('', 50);
        supplierOptions.value = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลเจ้าหนี้:', error);
        supplierOptions.value = [];
    } finally {
        isSearchingSupplier.value = false;
    }
};

// debounce ค้นหาเจ้าหนี้
const filterSuppliers = (event) => {
    const searchTerm = event.value || '';
    if (supplierSearchTimer) clearTimeout(supplierSearchTimer);
    supplierSearchTimer = setTimeout(async () => {
        try {
            isSearchingSupplier.value = true;
            const data = await SupplierService.getSuppliers(searchTerm, 100);
            supplierOptions.value = Array.isArray(data) ? data : [];
        } catch (error) {
            supplierOptions.value = [];
        } finally {
            isSearchingSupplier.value = false;
        }
    }, 1000);
};

// ฟังก์ชันยืนยันการเปลี่ยนเจ้าหนี้
const confirmChangeSupplier = async () => {
    if (!selectedSupplier.value) return;

    const supplier = selectedSupplier.value;
    localStorage.setItem('_userCode', supplier.code);
    localStorage.setItem('_userData', JSON.stringify({ user_code: supplier.code, user_name: supplier.name }));

    authenStore.userData = { user_code: supplier.code, user_name: supplier.name };
    authenStore.userCode = supplier.code;

    userData.value = { user_code: supplier.code, user_name: supplier.name };
    storeName.value = supplier.name;

    showSupplierDialog.value = false;
    window.location.reload();
};

// ฟังก์ชันโหลดรายการคลัง
const loadWarehouses = async () => {
    try {
        isLoadingWarehouses.value = true;
        const response = await WarehouseService.getWarehouseList();

        if (response && response.success && Array.isArray(response.data)) {
            warehouseOptions.value = response.data;
            allWarehouseOptions.value = response.data;
        } else {
            warehouseOptions.value = [];
            allWarehouseOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลคลัง:', error);
        warehouseOptions.value = [];
        allWarehouseOptions.value = [];
    } finally {
        isLoadingWarehouses.value = false;
    }
};

// ฟังก์ชัน filter คลัง
const filterWarehouses = (event) => {
    const searchTerm = (event.value || '').trim();
    const searchTermLower = searchTerm.toLowerCase();

    if (!searchTerm) {
        warehouseOptions.value = [...allWarehouseOptions.value];
        return;
    }

    warehouseOptions.value = allWarehouseOptions.value.filter((warehouse) => {
        const code = (warehouse.code || '').toLowerCase();
        const name = (warehouse.name || '').toLowerCase();

        const matched = code.includes(searchTermLower) || name.includes(searchTermLower);
        // console.log('Filtering warehouse:', { code, name, searchTermLower, matched });
        return matched;
    });

    // console.log('Filtered warehouses count:', warehouseOptions.value.length, warehouseOptions.value);
};

// ฟังก์ชันเปิด dialog เปลี่ยนคลัง
const openChangeWarehouseDialog = async () => {
    await loadWarehouses();
    // ตั้งค่าคลังปัจจุบันเป็นค่าเริ่มต้น
    if (warehouseCode.value) {
        selectedWarehouse.value = warehouseOptions.value.find((w) => w.code === warehouseCode.value) || null;
    }
    showWarehouseDialog.value = true;
};

// ฟังก์ชันยืนยันการเปลี่ยนคลัง
const confirmChangeWarehouse = () => {
    if (!selectedWarehouse.value) {
        alert('กรุณาเลือกคลัง');
        return;
    }

    // บันทึกข้อมูลคลังใหม่ลง localStorage
    localStorage.setItem('_selectedWarehouse', JSON.stringify(selectedWarehouse.value));
    localStorage.setItem('_warehouseCode', selectedWarehouse.value.code);
    localStorage.setItem('_warehouseName', selectedWarehouse.value.name);

    // อัพเดตค่าแสดงผล
    warehouseCode.value = selectedWarehouse.value.code;
    warehouseName.value = selectedWarehouse.value.name;

    // ปิด dialog
    showWarehouseDialog.value = false;

    // รีโหลดหน้าเพื่อให้ข้อมูลอัพเดต
    window.location.reload();
};

// ดึงข้อมูลเมื่อคอมโพเนนต์ถูกโหลด
onMounted(() => {
    const userType = localStorage.getItem('_userType');
    isEmployee.value = userType === 'employee';

    warehouseCode.value = localStorage.getItem('_warehouseCode') ?? '';
    warehouseName.value = localStorage.getItem('_warehouseName') ?? '';

    // ถ้าผู้ใช้เป็นพนักงาน ให้ดึงข้อมูลพนักงาน
    if (isEmployee.value) {
        const empDataStr = localStorage.getItem('_empData');
        const userDataStr = localStorage.getItem('_userData');

        if (empDataStr) {
            try {
                employeeData.value = JSON.parse(empDataStr);
            } catch (e) {
                console.error('Error parsing employee data:', e);
            }
        }

        if (userDataStr) {
            try {
                userData.value = JSON.parse(userDataStr);
                // ดึงชื่อร้านค้าจากข้อมูลผู้ใช้
                storeName.value = userData.value.user_name || '';
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
    }
});
</script>

<template>
    <!-- แสดงข้อมูลพนักงาน -->
    <div v-if="isEmployee && (employeeData || userData)" class="user-info employee-info">
        <div class="user-profile">
            <div class="user-welcome">
                <span class="welcome-text">คลัง</span>
                <div class="warehouse-row">
                    <span class="user-name">{{ warehouseCode }} ~ {{ warehouseName }}</span>
                    <Button icon="pi pi-sync" text rounded size="small" @click="openChangeWarehouseDialog" v-tooltip.top="'เปลี่ยนคลัง'" class="change-warehouse-btn" />
                </div>

                <span class="welcome-text">พนักงาน</span>
                <span class="user-name">{{ employeeData?.user_code }} ~ {{ employeeData?.user_name }}</span>
                <span class="welcome-text">คุณกำลังเปิดบิลร้าน</span>
                <div class="warehouse-row">
                    <span class="user-name">{{ userData?.user_code }} ~ {{ userData?.user_name }}</span>
                    <Button icon="pi pi-sync" text rounded size="small" @click="openChangeSupplierDialog" v-tooltip.top="'เปลี่ยนเจ้าหนี้'" class="change-warehouse-btn" />
                </div>
            </div>
        </div>
    </div>

    <!-- Dialog เปลี่ยนเจ้าหนี้ -->
    <Dialog v-model:visible="showSupplierDialog" header="เปลี่ยนเจ้าหนี้" :modal="true" :style="{ width: '400px' }" :closable="true">
        <div class="p-fluid">
            <div class="field">
                <label class="font-medium mb-2 block">เลือกเจ้าหนี้</label>
                <Select
                    v-model="selectedSupplier"
                    :options="supplierOptions"
                    optionLabel="name"
                    placeholder="เลือกเจ้าหนี้"
                    class="w-full"
                    :loading="isSearchingSupplier"
                    filter
                    :filterFields="['code', 'name']"
                    @filter="filterSuppliers"
                    filterPlaceholder="พิมพ์ชื่อหรือรหัสเจ้าหนี้"
                >
                    <template #value="slotProps">
                        <div v-if="slotProps.value" class="flex items-center">
                            <i class="pi pi-building mr-2 text-primary"></i>
                            <div>{{ slotProps.value.code }} ~ {{ slotProps.value.name }}</div>
                        </div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                    <template #option="slotProps">
                        <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                            <div class="font-bold">{{ slotProps.option.code }}</div>
                            <div>{{ slotProps.option.name }}</div>
                        </div>
                    </template>
                </Select>
            </div>
        </div>
        <template #footer>
            <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showSupplierDialog = false" />
            <Button label="ยืนยัน" icon="pi pi-check" severity="success" @click="confirmChangeSupplier" :disabled="!selectedSupplier" />
        </template>
    </Dialog>

    <!-- Dialog เปลี่ยนคลัง -->
    <Dialog v-model:visible="showWarehouseDialog" header="เปลี่ยนคลัง" :modal="true" :style="{ width: '400px' }" :closable="true">
        <div class="p-fluid">
            <div class="field">
                <label for="warehouse" class="font-medium mb-2 block">เลือกคลัง</label>
                <Select
                    id="warehouse"
                    v-model="selectedWarehouse"
                    :options="warehouseOptions"
                    optionLabel="name"
                    placeholder="เลือกคลัง"
                    class="w-full"
                    :loading="isLoadingWarehouses"
                    filter
                    :filterFields="['code', 'name']"
                    @filter="filterWarehouses"
                    filterPlaceholder="พิมพ์ชื่อหรือรหัสคลัง"
                >
                    <template #value="slotProps">
                        <div v-if="slotProps.value" class="flex items-center">
                            <i class="pi pi-building mr-2 text-primary"></i>
                            <div>{{ slotProps.value.code }} ~ {{ slotProps.value.name }}</div>
                        </div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                    <template #option="slotProps">
                        <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                            <div class="font-bold">{{ slotProps.option.code }}~</div>
                            <div>{{ slotProps.option.name }}</div>
                        </div>
                    </template>
                </Select>
            </div>
        </div>

        <template #footer>
            <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showWarehouseDialog = false" />
            <Button label="ยืนยัน" icon="pi pi-check" severity="success" @click="confirmChangeWarehouse" :disabled="!selectedWarehouse" />
        </template>
    </Dialog>

</template>

<style lang="scss" scoped>
.user-info {
    padding: 1rem;
    margin-bottom: 1rem;
    background-color: var(--surface-card, #ffffff);
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    i {
        font-size: 1.5rem;
        color: var(--primary-color, #3b82f6);
        background-color: var(--primary-50, #eff6ff);
        border-radius: 50%;
        padding: 0.5rem;
    }

    .user-welcome {
        display: flex;
        flex-direction: column;

        .warehouse-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;

            .change-warehouse-btn {
                padding: 0.25rem;
                width: 1.5rem;
                height: 1.5rem;
            }
        }

        .welcome-text {
            font-size: 0.875rem;
            color: var(--text-color-secondary, #6c757d);
        }

        .user-name {
            font-weight: 600;
            font-size: 0.875rem;
            color: var(--text-color, #495057);
        }
    }
}
</style>
