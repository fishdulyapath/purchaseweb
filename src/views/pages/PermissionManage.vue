<script setup>
import axios from 'axios';
import AutoComplete from 'primevue/autocomplete';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const apiBase = import.meta.env.VITE_APP_API;

// superadmin check
const isSuperAdmin = () => {
    const code = localStorage.getItem('_empCode') || '';
    return code.toUpperCase() === 'SUPERADMIN';
};

onMounted(() => {
    if (!isSuperAdmin()) {
        router.replace({ name: 'accessDenied' });
    }
});

// Employee search
const employeeQuery = ref('');
const employeeSuggestions = ref([]);
const selectedEmployee = ref(null);

async function searchEmployee(event) {
    const search = event.query || '';
    try {
        const res = await axios.get(`${apiBase}/getEmployeeList`, { params: { search } });
        employeeSuggestions.value = (res.data?.data || []).map((e) => ({
            label: `${e.code} - ${e.name}`,
            code: e.code,
            name: e.name
        }));
    } catch (e) {
        employeeSuggestions.value = [];
    }
}

// Permissions state
const SCREENS = [
    { key: 'pr_approve', label: 'อนุมัติเสนอซื้อ (PR)', icon: 'pi pi-check-square' },
    { key: 'po', label: 'ใบสั่งซื้อ (PO)', icon: 'pi pi-file-edit' },
    { key: 'pu', label: 'ใบรับสินค้า (PU)', icon: 'pi pi-download' }
];

const permissions = ref({ pr_approve: false, po: false, pu: false });
const isLoadingPerms = ref(false);
const isSaving = ref(false);

async function onSelectEmployee(event) {
    selectedEmployee.value = event.value;
    await loadPermissions(event.value.code);
}

async function loadPermissions(empCode) {
    isLoadingPerms.value = true;
    try {
        const res = await axios.get(`${apiBase}/getEmpPermission`, { params: { emp_code: empCode } });
        const data = res.data?.data || [];
        // default = ไม่อนุญาต ถ้าไม่มีข้อมูลใน DB
        const perms = { pr_approve: false, po: false, pu: false };
        for (const item of data) {
            if (item.screen_code in perms) {
                perms[item.screen_code] = item.is_allow === 1 || item.is_allow === '1';
            }
        }
        permissions.value = perms;
    } catch (e) {
        permissions.value = { pr_approve: false, po: false, pu: false };
    } finally {
        isLoadingPerms.value = false;
    }
}

async function savePermissions() {
    if (!selectedEmployee.value) return;
    isSaving.value = true;
    try {
        const payload = {
            emp_code: selectedEmployee.value.code,
            permissions: SCREENS.map((s) => ({
                screen_code: s.key,
                is_allow: permissions.value[s.key] ? 1 : 0
            })),
            created_by: localStorage.getItem('_empCode') || 'superadmin'
        };
        await axios.post(`${apiBase}/saveEmpPermission`, payload);
        toast.add({ severity: 'success', summary: 'บันทึกสำเร็จ', detail: `อัปเดตสิทธิ์ ${selectedEmployee.value.name} แล้ว`, life: 3000 });
    } catch (e) {
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถบันทึกสิทธิ์ได้', life: 3000 });
    } finally {
        isSaving.value = false;
    }
}
</script>

<template>
    <div class="p-4 max-w-2xl mx-auto">
        <div class="mb-6">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <i class="pi pi-shield text-blue-600"></i>
                กำหนดสิทธิ์การเข้าหน้าจอ
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">กำหนดสิทธิ์การเข้าใช้งานเมนูต่าง ๆ ให้กับพนักงาน</p>
        </div>

        <!-- Employee Search -->
        <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">เลือกพนักงาน</label>
            <AutoComplete
                v-model="employeeQuery"
                :suggestions="employeeSuggestions"
                optionLabel="label"
                placeholder="ค้นหาด้วยรหัสหรือชื่อพนักงาน..."
                class="w-full"
                inputClass="w-full"
                :delay="300"
                @complete="searchEmployee"
                @option-select="onSelectEmployee"
            />
        </div>

        <!-- Permission Table -->
        <div v-if="selectedEmployee" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div class="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-2">
                    <i class="pi pi-user text-blue-600"></i>
                    <span class="font-medium text-gray-800 dark:text-gray-100">{{ selectedEmployee.name }}</span>
                    <span class="text-sm text-gray-400">({{ selectedEmployee.code }})</span>
                </div>
            </div>

            <div v-if="isLoadingPerms" class="flex justify-center items-center py-10">
                <i class="pi pi-spin pi-spinner text-blue-500 text-2xl"></i>
            </div>

            <table v-else class="w-full">
                <thead>
                    <tr class="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th class="px-4 py-3 font-medium">หน้าจอ</th>
                        <th class="px-4 py-3 font-medium text-center w-28">อนุญาต</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="screen in SCREENS" :key="screen.key" class="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td class="px-4 py-4">
                            <div class="flex items-center gap-2">
                                <i :class="[screen.icon, 'text-gray-400 dark:text-gray-500']"></i>
                                <span class="text-gray-700 dark:text-gray-300">{{ screen.label }}</span>
                            </div>
                        </td>
                        <td class="px-4 py-4 text-center">
                            <ToggleSwitch v-model="permissions[screen.key]" />
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="px-4 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                <Button
                    label="บันทึกสิทธิ์"
                    icon="pi pi-save"
                    severity="success"
                    :loading="isSaving"
                    :disabled="isLoadingPerms"
                    @click="savePermissions"
                />
            </div>
        </div>

        <div v-else class="text-center py-16 text-gray-400 dark:text-gray-500">
            <i class="pi pi-users text-5xl mb-3 block opacity-30"></i>
            <p>เลือกพนักงานเพื่อกำหนดสิทธิ์</p>
        </div>
    </div>
</template>
