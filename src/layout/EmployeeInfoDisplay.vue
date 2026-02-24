<script setup>
import SupplierService from '@/services/SupplierService';
import { useAuthenStore } from '@/stores/authen';
import { onMounted, ref } from 'vue';

const authenStore = useAuthenStore();

const isEmployee = ref(false);
const employeeData = ref(null);
const userData = ref(null);
const storeName = ref('');

// ตัวแปรสำหรับเปลี่ยนเจ้าหนี้
const showSupplierDialog = ref(false);
const selectedSupplier = ref(null);
const supplierOptions = ref([]);
const isSearchingSupplier = ref(false);
let supplierSearchTimer = null;

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

onMounted(() => {
    const userType = localStorage.getItem('_userType');
    isEmployee.value = userType === 'employee';

    if (isEmployee.value) {
        const empDataStr = localStorage.getItem('_empData');
        const userDataStr = localStorage.getItem('_userData');
        if (empDataStr) {
            try { employeeData.value = JSON.parse(empDataStr); } catch (e) { console.error(e); }
        }
        if (userDataStr) {
            try {
                userData.value = JSON.parse(userDataStr);
                storeName.value = userData.value.user_name || '';
            } catch (e) { console.error(e); }
        }
    }
});
</script>

<template>
    <div v-if="isEmployee && (employeeData || userData)" class="user-info employee-info">
        <div class="user-profile">
            <div class="user-welcome">
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
