<script setup>
import ProductService from '@/services/ProductService';
import { ref } from 'vue';

const props = defineProps({
    cartItems: {
        type: Array,
        required: true
    },
    userType: {
        type: String,
        default: ''
    },
    userData: {
        type: Object,
        default: () => ({})
    },
    orderData: {
        type: Object,
        default: () => ({})
    },
    totals: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['prev-step', 'process-checkout']);

const isCheckingOut = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const showConfirmDialog = ref(false);

const formData = ref({
    remark: props.orderData.remark || ''
});

function handleCheckout() {
    if (isSubmitting.value) return;
    showConfirmDialog.value = true;
}

async function confirmCheckout() {
    showConfirmDialog.value = false;
    isSubmitting.value = true;
    await proceedCheckout();
}

async function proceedCheckout() {
    try {
        isCheckingOut.value = true;

        const dataToSend = {
            ...formData.value,
            items: props.cartItems
        };

        const success = await emit('process-checkout', dataToSend);

        if (!success) {
            isCheckingOut.value = false;
            isSubmitting.value = false;
        }
    } catch (error) {
        console.error('Checkout error:', error);
        errorMessage.value = 'เกิดข้อผิดพลาดในการสั่งซื้อ โปรดลองใหม่อีกครั้ง';
        isCheckingOut.value = false;
        isSubmitting.value = false;
    }
}

function formatNumber(value) {
    if (value === undefined || value === null) return '0.00';
    const num = parseFloat(value);
    return !isNaN(num)
        ? num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';
}

function getProductImage(itemCode) {
    if (!itemCode) {
        return 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
    }
    return ProductService.getProductImageUrl(itemCode);
}

function handleImageError(event) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}
</script>

<template>
    <div>
        <h2 class="text-xl font-bold mb-4">ยืนยันการสั่งซื้อ</h2>

        <!-- Order summary -->
        <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">สรุปรายการสั่งซื้อ</h3>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div v-for="(item, index) in cartItems" :key="item.id" :class="['flex items-center gap-3', index !== cartItems.length - 1 ? 'border-b border-gray-200 dark:border-gray-700 pb-3 mb-3' : '']">
                    <!-- Thumbnail -->
                    <div class="w-12 h-12 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                        <img :src="getProductImage(item.item_code)" :alt="item.item_name" class="w-full h-full object-contain" @error="handleImageError" />
                    </div>

                    <!-- Details -->
                    <div class="flex-grow">
                        <div class="font-medium">{{ item.item_name }}</div>
                        <div class="text-sm text-gray-500">{{ item.item_code }} - {{ item.unit_code }}</div>
                    </div>

                    <!-- Qty & Price -->
                    <div class="text-right">
                        <div class="font-medium">฿{{ formatNumber(item.price * item.qty) }}</div>
                        <div class="text-sm text-gray-500">{{ item.qty }} x ฿{{ formatNumber(item.price) }}</div>
                    </div>
                </div>

                <!-- Totals -->
                <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-gray-600 dark:text-gray-400">จำนวนสินค้า:</span>
                        <span>{{ totals.totalItems }} ชิ้น</span>
                    </div>
                    <div class="flex justify-between items-center text-lg font-bold">
                        <span>ยอดรวมทั้งสิ้น:</span>
                        <span class="text-primary">฿{{ formatNumber(totals.totalAmount) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- หมายเหตุ -->
        <div class="mb-6">
            <label for="order-remark" class="block font-medium mb-2">หมายเหตุ</label>
            <Textarea id="order-remark" v-model="formData.remark" rows="3" class="w-full" placeholder="ระบุหมายเหตุหรือข้อความอื่นๆ" />
        </div>

        <!-- Error message -->
        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

        <!-- Action buttons -->
        <div class="flex justify-between mt-6">
            <Button label="ย้อนกลับ" icon="pi pi-arrow-left" outlined @click="emit('prev-step')" />
            <Button label="ยืนยันเสนอซื้อ" icon="pi pi-check" @click="handleCheckout" :loading="isCheckingOut" :disabled="isSubmitting" />
        </div>

        <!-- Confirm Dialog -->
        <Dialog v-model:visible="showConfirmDialog" modal header="ยืนยันการเสนอซื้อ" :style="{ width: '380px' }" :closable="!isCheckingOut">
            <div class="flex items-start gap-3 py-2">
                <i class="pi pi-question-circle text-3xl text-primary mt-1"></i>
                <div>
                    <div class="font-medium mb-1">คุณต้องการยืนยันการเสนอซื้อใช่หรือไม่?</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">ยอดรวม ฿{{ formatNumber(totals.totalAmount) }} ({{ totals.totalItems }} ชิ้น)</div>
                </div>
            </div>
            <template #footer>
                <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showConfirmDialog = false" />
                <Button label="ยืนยัน" icon="pi pi-check" @click="confirmCheckout" :loading="isCheckingOut" />
            </template>
        </Dialog>
    </div>
</template>
