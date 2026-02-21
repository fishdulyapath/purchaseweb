<script setup>
import SupplierService from '@/services/SupplierService';
import WarehouseService from '@/services/WarehouseList';
import { useAuthenStore } from '@/stores/authen';
import { useCartStore } from '@/stores/cartStore';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const authenStore = useAuthenStore();
const cartStore = useCartStore();

const hasSavedCredentials = ref(false);

// Form refs
const username = ref('');
const password = ref('');
const rememberMe = ref(false);

// Supplier search (หลัง employee login)
const showSupplierSearch = ref(false);
const selectedSupplier = ref(null);
const isSearching = ref(false);
const supplierOptions = ref([]);

// เลือกคลัง
const showSelectionScreen = ref(false);
const selectedWarehouse = ref(null);
const isLoadingWarehouses = ref(false);
const warehouseOptions = ref([]);
const allWarehouseOptions = ref([]);

// ประเภทการขาย
const saleType = ref(1);

onMounted(() => {
    authenStore.loginErrorMsg = '';

    try {
        if (typeof localStorage !== 'undefined') {
            const savedUsername = localStorage.getItem('_savedUsername');
            const shouldRemember = localStorage.getItem('_rememberMe') === 'true';

            hasSavedCredentials.value = !!savedUsername;

            if (savedUsername) {
                username.value = savedUsername;

                if (shouldRemember && localStorage.getItem('_savedPassword')) {
                    try {
                        password.value = atob(localStorage.getItem('_savedPassword'));
                        rememberMe.value = true;
                    } catch (e) {
                        password.value = '';
                    }
                }
            }
        }
    } catch (e) {
        console.error('ไม่สามารถเข้าถึง localStorage ได้:', e);
    }
});

const doLogin = async (e) => {
    if (e) e.preventDefault();

    const inputUsername = username.value;
    const inputPassword = password.value;

    try {
        if (typeof localStorage !== 'undefined') {
            if (rememberMe.value) {
                localStorage.setItem('_savedUsername', inputUsername);
                localStorage.setItem('_savedPassword', btoa(inputPassword));
                localStorage.setItem('_rememberMe', 'true');
                hasSavedCredentials.value = true;
            } else {
                localStorage.removeItem('_savedUsername');
                localStorage.removeItem('_savedPassword');
                localStorage.removeItem('_rememberMe');
                hasSavedCredentials.value = false;
            }
        }
    } catch (e) {
        console.error('ไม่สามารถบันทึกข้อมูลใน localStorage ได้:', e);
    }

    const success = await authenStore.loginEmployee(inputUsername, inputPassword);

    if (success && authenStore.isAuthenticated && authenStore.isEmployee) {
        try {
            await loadWarehouses();
            showSelectionScreen.value = true;
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
            router.push('/');
        }
    }
};

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
        throw error;
    } finally {
        isLoadingWarehouses.value = false;
    }
};

const filterWarehouses = (event) => {
    const searchTerm = (event.value || '').toLowerCase().trim();
    if (!searchTerm) {
        warehouseOptions.value = [...allWarehouseOptions.value];
        return;
    }
    warehouseOptions.value = allWarehouseOptions.value.filter((w) => {
        const code = (w.code || '').toLowerCase();
        const name = (w.name || '').toLowerCase();
        return code.includes(searchTerm) || name.includes(searchTerm);
    });
};

// ยืนยันการตั้งค่า (คลัง + ประเภทการขาย) แล้วไปเลือกเจ้าหนี้
const confirmAllSelections = async () => {
    if (!selectedWarehouse.value) {
        alert('กรุณาเลือกคลังก่อนดำเนินการต่อ');
        return;
    }

    localStorage.setItem('_selectedWarehouse', JSON.stringify(selectedWarehouse.value));
    localStorage.setItem('_warehouseCode', selectedWarehouse.value.code);
    localStorage.setItem('_warehouseName', selectedWarehouse.value.name);
    localStorage.setItem('_saleType', saleType.value.toString());
    localStorage.setItem('_saleTypeName', saleType.value === 1 ? 'เงินสด' : 'เงินเชื่อ');

    showSelectionScreen.value = false;
    await proceedToSupplierSelection();
};

// โหลดและแสดงหน้าเลือกเจ้าหนี้
const proceedToSupplierSelection = async () => {
    try {
        isSearching.value = true;
        const data = await SupplierService.getSuppliers('', 50);
        supplierOptions.value = Array.isArray(data) ? data : [];
        showSupplierSearch.value = true;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลเจ้าหนี้:', error);
        supplierOptions.value = [];
        showSupplierSearch.value = true;
    } finally {
        isSearching.value = false;
    }
};

let supplierSearchTimer = null;

const filterSuppliers = (event) => {
    const searchTerm = event.value || '';

    if (supplierSearchTimer) clearTimeout(supplierSearchTimer);

    supplierSearchTimer = setTimeout(async () => {
        try {
            isSearching.value = true;
            const data = await SupplierService.getSuppliers(searchTerm, 100);
            supplierOptions.value = Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการค้นหาเจ้าหนี้:', error);
            supplierOptions.value = [];
        } finally {
            isSearching.value = false;
        }
    }, 1000);
};

const confirmSupplierSelection = async () => {
    if (!selectedSupplier.value) return;

    const supplier = selectedSupplier.value;

    localStorage.setItem('_userCode', supplier.code);
    localStorage.setItem(
        '_userData',
        JSON.stringify({
            user_code: supplier.code,
            user_name: supplier.name
        })
    );

    authenStore.userData = {
        user_code: supplier.code,
        user_name: supplier.name
    };
    authenStore.userCode = supplier.code;

    try {
        const warehouseCode = localStorage.getItem('_warehouseCode');
        await cartStore.loadCartItemsForCustomer(supplier.code, warehouseCode);
    } catch (error) {
        console.error('Error loading cart items:', error);
    }

    showSupplierSearch.value = false;
    router.push('/');
};

const logout = () => {
    authenStore.logout();
    showSupplierSearch.value = false;
    showSelectionScreen.value = false;
    selectedSupplier.value = null;
    selectedWarehouse.value = null;
    saleType.value = 1;

    const savedUsername = localStorage.getItem('_savedUsername');
    if (savedUsername) {
        username.value = savedUsername;
        if (localStorage.getItem('_rememberMe') === 'true' && localStorage.getItem('_savedPassword')) {
            password.value = atob(localStorage.getItem('_savedPassword'));
            rememberMe.value = true;
        } else {
            password.value = '';
            rememberMe.value = false;
        }
    } else {
        username.value = '';
        password.value = '';
        rememberMe.value = false;
    }

    authenStore.loginErrorMsg = '';
};

const showLoginForm = computed(() => {
    return !showSupplierSearch.value && !showSelectionScreen.value;
});
</script>

<template>
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center w-full px-2 sm:px-4 md:max-w-lg lg:max-w-lg">
            <div class="w-full" style="border-radius: 36px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-3 sm:py-4 md:py-6 lg:py-10 px-3 sm:px-5 md:px-6 lg:px-8" style="border-radius: 34px">
                    <!-- Logo and header -->
                    <div class="text-center mb-6">
                        <div class="flex justify-center mb-3 sm:mb-4">
                            <img src="../../../assets/logokrabi.png" alt="Wawa 2559" width="120" class="sm:w-150 md:w-180 lg:w-200 rounded-full shadow-md hover:shadow-lg transition-shadow duration-300" />
                        </div>
                        <div class="text-surface-900 dark:text-surface-0 text-2xl sm:text-2xl md:text-2xl font-medium mb-1">
                            <span class="bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-primary-300">Purchase Yang Tong</span>
                        </div>

                        <div class="p-badge p-component p-badge-info my-2 inline-block">
                            <span v-if="showSupplierSearch" class="text-sm font-medium">กรุณาเลือกเจ้าหนี้</span>
                            <span v-else-if="showSelectionScreen" class="text-sm font-medium">กรุณาตั้งค่าการสั่งซื้อ</span>
                            <span v-else class="text-sm font-medium">เข้าสู่ระบบสั่งซื้อสำหรับพนักงาน</span>
                        </div>
                    </div>

                    <!-- ส่วนค้นหาเจ้าหนี้ (หลัง login แล้ว) -->
                    <div v-if="showSupplierSearch" class="supplier-search-section">
                        <div v-if="isSearching && supplierOptions.length === 0" class="flex flex-column align-items-center justify-content-center p-2 sm:p-4 gap-2">
                            <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                        </div>

                        <div class="mb-3 sm:mb-4">
                            <label class="block text-surface-900 dark:text-surface-0 font-medium mb-1 sm:mb-2">ค้นหาเจ้าหนี้</label>

                            <Select
                                v-model="selectedSupplier"
                                :options="supplierOptions"
                                optionLabel="name"
                                placeholder="เลือกเจ้าหนี้"
                                class="w-full"
                                :loading="isSearching"
                                filter
                                :filterFields="['code', 'name']"
                                @filter="filterSuppliers"
                                filterPlaceholder="พิมพ์ชื่อหรือรหัสเจ้าหนี้"
                                :showClear="true"
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

                            <small class="text-color-secondary">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา หรือเลือกจากรายการ</small>
                        </div>

                        <!-- แสดงข้อมูลเจ้าหนี้ที่เลือก -->
                        <div v-if="selectedSupplier" class="mt-3 sm:mt-4">
                            <Card class="border-1 border-primary-200 dark:border-primary-800 shadow-3">
                                <template #header>
                                    <div class="flex align-items-center gap-2 p-2 sm:p-3 bg-primary-50 dark:bg-primary-900">
                                        <i class="pi pi-building text-primary" style="font-size: 1.25rem"></i>
                                        <h3 class="m-0 font-medium text-lg sm:text-xl">ข้อมูลเจ้าหนี้</h3>
                                    </div>
                                </template>
                                <template #content>
                                    <div class="grid">
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">รหัส:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedSupplier.code }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">ชื่อ:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedSupplier.name }}</div>
                                        </div>
                                    </div>
                                </template>
                                <template #footer>
                                    <div class="flex flex-column sm:flex-row gap-2 justify-content-between">
                                        <Button icon="pi pi-times" label="ยกเลิก" severity="secondary" outlined class="w-full sm:w-auto" @click="selectedSupplier = null" />
                                        <Button icon="pi pi-check" label="ใช้เจ้าหนี้นี้" severity="success" class="w-full sm:w-auto" @click="confirmSupplierSelection" />
                                    </div>
                                </template>
                            </Card>
                        </div>

                        <div class="mt-3 mb-3 sm:mt-4 sm:mb-4">
                            <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                        </div>
                    </div>

                    <!-- ส่วนตั้งค่าการสั่งซื้อ (คลัง + ประเภท) -->
                    <div v-if="showSelectionScreen" class="selection-screen">
                        <div v-if="isLoadingWarehouses && warehouseOptions.length === 0" class="flex flex-column align-items-center justify-content-center p-2 sm:p-4 gap-2">
                            <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                            <span class="text-sm">กำลังโหลดข้อมูล...</span>
                        </div>

                        <div v-else>
                            <!-- เลือกคลัง (บังคับ) -->
                            <div class="mb-3 sm:mb-4">
                                <label class="block text-surface-900 dark:text-surface-0 font-medium mb-1 sm:mb-2">
                                    <i class="pi pi-building mr-2"></i>เลือกคลัง <span class="text-red-500">*</span>
                                </label>
                                <Select
                                    v-model="selectedWarehouse"
                                    :options="warehouseOptions"
                                    optionLabel="name"
                                    placeholder="เลือกคลัง"
                                    class="w-full"
                                    :loading="isLoadingWarehouses"
                                    :showClear="false"
                                    filter
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
                                            <div class="font-bold">{{ slotProps.option.code }}</div>
                                            <div>{{ slotProps.option.name }}</div>
                                        </div>
                                    </template>
                                </Select>
                                <small class="text-color-secondary">บังคับเลือกคลัง</small>
                            </div>

                            <div class="flex flex-column sm:flex-row gap-2 mb-4">
                                <Button label="ถัดไป: เลือกเจ้าหนี้" icon="pi pi-arrow-right" iconPos="right" severity="success" class="w-full" @click="confirmAllSelections" :disabled="!selectedWarehouse" />
                            </div>

                            <div class="mt-2">
                                <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                            </div>
                        </div>
                    </div>

                    <!-- ฟอร์ม login พนักงาน -->
                    <div v-if="showLoginForm">
                        <form @submit="doLogin">
                            <label for="employee-code" class="block text-surface-900 dark:text-surface-0 text-base sm:text-lg font-medium mb-1"> รหัสพนักงาน </label>
                            <InputText id="employee-code" type="text" placeholder="รหัสพนักงาน" class="w-full mb-3 sm:mb-4" v-model="username" @keyup.enter="doLogin" />

                            <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-base sm:text-lg mb-1">รหัสผ่าน</label>
                            <Password id="password1" v-model="password" placeholder="รหัสผ่าน" :toggleMask="true" class="mb-3 sm:mb-4" fluid :feedback="false" @keyup.enter="doLogin"></Password>

                            <div class="flex items-center justify-between mt-1 mb-4 sm:mb-6 gap-2 sm:gap-8">
                                <div class="flex items-center">
                                    <Checkbox v-model="rememberMe" id="rememberMe" binary class="mr-2"></Checkbox>
                                    <label for="rememberMe" class="text-sm sm:text-base">Remember me</label>
                                </div>
                            </div>

                            <transition name="slide-fade">
                                <div v-if="authenStore.loginErrorMsg" class="p-2 sm:p-3 bg-red-100 text-red-700 rounded-lg mb-3 sm:mb-4 dark:bg-red-900 dark:text-red-100 flex items-center">
                                    <i class="pi pi-exclamation-triangle mr-2 text-red-500"></i>
                                    <span class="text-sm sm:text-base">{{ authenStore.loginErrorMsg }}</span>
                                </div>
                            </transition>

                            <Button label="เข้าสู่ระบบ" icon="pi pi-sign-in" class="w-full p-button-md sm:p-button-lg p-button-rounded hover:shadow-lg transition-shadow duration-200" type="submit" :loading="authenStore.loading"> </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
