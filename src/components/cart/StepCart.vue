<script setup>
import ProductService from '@/services/ProductService';
import { useCartStore } from '@/stores/cartStore';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed } from 'vue';

const props = defineProps({
    cartItems: {
        type: Array,
        required: true
    },
    userType: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update-item', 'set-cart-changed', 'next-step', 'go-to-shop', 'refresh-cart']);

const confirm = useConfirm();
const toast = useToast();
const cartStore = useCartStore();

// Local references to cart data
const items = computed(() => props.cartItems);

// Calculate totals
const totalAmount = computed(() => items.value.reduce((total, item) => total + parseFloat(item.price) * parseInt(item.qty), 0));
const totalItems = computed(() => items.value.reduce((count, item) => count + parseInt(item.qty), 0));

// Handle quantity changes
async function increaseQuantity(item) {
    try {
        const newQty = parseInt(item.qty) + 1;
        item.qty = newQty;
        emit('set-cart-changed');
        await updateItemInCart(item);
    } catch (error) {
        console.error('Error updating quantity:', error);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถเพิ่มจำนวนสินค้าได้', life: 1500 });
        item.qty = parseInt(item.qty) - 1;
    }
}

async function decreaseQuantity(item) {
    if (parseInt(item.qty) > 1) {
        try {
            const newQty = parseInt(item.qty) - 1;
            item.qty = newQty;
            emit('set-cart-changed');
            await updateItemInCart(item);
        } catch (error) {
            console.error('Error updating quantity:', error);
            toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถลดจำนวนสินค้าได้', life: 1500 });
            item.qty = parseInt(item.qty) + 1;
        }
    }
}

// Update item in cart
async function updateItemInCart(item) {
    try {
        const updatedItem = { ...item, qty: parseInt(item.qty) };
        emit('update-item', updatedItem);
        toast.add({ severity: 'success', summary: 'อัพเดทสินค้า', detail: `ปรับจำนวน ${item.item_name} เป็น ${item.qty} ชิ้นแล้ว`, life: 1500 });
    } catch (error) {
        console.error('Error updating cart item:', error);
        throw error;
    }
}

// Remove item from cart
async function removeItem(itemId) {
    try {
        await cartStore.removeFromCart(itemId);
        emit('refresh-cart');
        toast.add({ severity: 'info', summary: 'ลบสินค้า', detail: 'ลบสินค้าออกจากตะกร้าแล้ว', life: 1500 });
    } catch (error) {
        console.error('Error removing item:', error);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถลบสินค้าได้', life: 1500 });
    }
}

// Clear cart
async function clearCart() {
    try {
        await cartStore.clearCart();
        emit('refresh-cart');
        toast.add({ severity: 'info', summary: 'ล้างตะกร้า', detail: 'นำสินค้าทั้งหมดออกจากตะกร้าแล้ว', life: 1500 });
    } catch (error) {
        console.error('Error clearing cart:', error);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถล้างตะกร้าได้', life: 1500 });
    }
}

// Confirmation dialogs
function confirmRemoveItem(item) {
    confirm.require({
        message: `คุณต้องการลบ ${item.item_name} ออกจากตะกร้าใช่หรือไม่?`,
        header: 'ยืนยันการลบ',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'ใช่, ลบเลย',
        rejectLabel: 'ยกเลิก',
        acceptClass: 'p-button-danger',
        accept: () => removeItem(item.id)
    });
}

function confirmClearCart() {
    confirm.require({
        message: 'คุณต้องการล้างตะกร้าทั้งหมดใช่หรือไม่?',
        header: 'ยืนยันการล้างตะกร้า',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'ใช่, ล้างเลย',
        rejectLabel: 'ยกเลิก',
        acceptClass: 'p-button-danger',
        accept: clearCart
    });
}

// Utility functions
function formatNumber(value) {
    if (value === undefined || value === null) return '0.00';
    const num = parseFloat(value);
    return !isNaN(num)
        ? num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';
}

function getProductImage(itemCode) {
    return itemCode ? ProductService.getProductImageUrl(itemCode) : 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

function handleImageError(event) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

// Navigation
function proceedToCheckout() {
    if (items.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'ตะกร้าว่างเปล่า', detail: 'กรุณาเพิ่มสินค้าในตะกร้าก่อนดำเนินการต่อ', life: 1500 });
        return;
    }
    emit('next-step');
}

function validateQuantity(item) {
    if (item.qty === '' || isNaN(parseInt(item.qty))) {
        item.qty = 1;
        updateItemInCart(item);
        return;
    }

    let numValue = parseInt(item.qty);
    if (numValue < 1) {
        item.qty = 1;
        updateItemInCart(item);
        return;
    }

    item.qty = numValue;
    emit('set-cart-changed');
    updateItemInCart(item);
}

function handleQuantityKeydown(event) {
    const isNumber = /^[0-9]$/.test(event.key);
    const isControl = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(event.key);
    if (!isNumber && !isControl) {
        event.preventDefault();
    }
}
</script>

<template>
    <!-- Empty cart -->
    <div v-if="items.length === 0" class="flex flex-col items-center justify-center p-8 text-center">
        <i class="pi pi-shopping-cart text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
        <h3 class="text-xl font-medium mb-2">ตะกร้าของคุณว่างเปล่า</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">เพิ่มสินค้าที่คุณต้องการลงในตะกร้า</p>
        <Button label="เลือกซื้อสินค้า" icon="pi pi-shopping-bag" @click="emit('go-to-shop')" />
    </div>

    <!-- Cart content -->
    <div v-else>
        <h2 class="text-xl font-bold mb-4">รายการสินค้าในตะกร้า</h2>

        <!-- Cart items -->
        <div class="mb-4">
            <div v-for="(item, index) in items" :key="item.id">
                <div :class="['flex items-start gap-3 sm:gap-4', index !== items.length - 1 ? 'border-b border-gray-100 dark:border-gray-700 pb-4 mb-4' : '']">
                    <!-- Product image -->
                    <div class="w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded-md flex-shrink-0 border border-gray-200 dark:border-gray-700">
                        <img :src="getProductImage(item.item_code)" :alt="item.item_code" class="w-full h-full object-contain cursor-pointer" @error="handleImageError" />
                    </div>

                    <!-- Product details -->
                    <div class="flex flex-col flex-grow">
                        <div class="flex justify-between items-start mb-2">
                            <div class="mr-2">
                                <div class="text-base sm:text-lg font-medium">{{ item.item_code }}</div>
                                <div class="text-base sm:text-lg font-medium">{{ item.item_name }}</div>
                                <div v-if="item.category" class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">{{ item.category }}</div>
                            </div>
                            <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmRemoveItem(item)" />
                        </div>

                        <!-- Price and quantity -->
                        <div class="flex justify-between items-end mt-auto">
                            <div class="flex items-center">
                                <Button icon="pi pi-minus" text rounded class="p-button-sm border border-gray-200 dark:border-gray-700" @click="decreaseQuantity(item)" :disabled="parseInt(item.qty) <= 1" />
                                <input
                                    type="text"
                                    v-model="item.qty"
                                    class="mx-2 text-center w-10 text-base border-0 focus:outline-none focus:ring-0 bg-transparent"
                                    @blur="validateQuantity(item)"
                                    @keydown="handleQuantityKeydown($event)"
                                />
                                <Button icon="pi pi-plus" text rounded class="p-button-sm border border-gray-200 dark:border-gray-700" @click="increaseQuantity(item)" />
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-lg sm:text-xl font-bold">฿{{ formatNumber(item.price * item.qty) }}</span>
                                <span class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">฿{{ formatNumber(item.price) }} / {{ item.unit_code }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center py-4 border-t border-gray-100 dark:border-gray-700">
            <Button icon="pi pi-trash" label="ล้างตะกร้า" severity="secondary" text @click="confirmClearCart" />
            <div class="flex flex-col items-end">
                <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ totalItems }} สินค้าในตะกร้า</div>
                <div class="text-xl font-bold">รวม: ฿{{ formatNumber(totalAmount) }}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-between mt-4">
            <Button label="เลือกซื้อสินค้าต่อ" icon="pi pi-arrow-left" outlined @click="emit('go-to-shop')" />
            <Button label="ดำเนินการต่อ" icon="pi pi-arrow-right" iconPos="right" @click="proceedToCheckout" />
        </div>
    </div>
</template>
