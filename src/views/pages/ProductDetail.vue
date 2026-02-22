<script setup>
import ProductService from '@/services/ProductService';
import { useAuthenStore } from '@/stores/authen';
import { useCartStore } from '@/stores/cartStore';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import Galleria from 'primevue/galleria';
import ProgressSpinner from 'primevue/progressspinner';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const product = ref(null);
const images = ref([]);
const loading = ref(true);
const loadingStock = ref(false);
const addingToCart = ref(false);
const toast = useToast();
const cartStore = useCartStore();
const selectedUnitIndex = ref(0);

// ข้อมูลสต็อกตาม location
const stockLocations = ref([]);
// จำนวนสั่งซื้อรวม
const orderQuantity = ref(0);

const authenStore = useAuthenStore();
const isLoggedIn = computed(() => authenStore.isAuthenticated);

// สไลด์กาลเลอรี่ responsive options
const galleryOptions = ref([
    { breakpoint: '992px', numVisible: 5 },
    { breakpoint: '768px', numVisible: 4 },
    { breakpoint: '576px', numVisible: 3 }
]);

// ตรวจสอบว่าสินค้านี้อยู่ในตะกร้าหรือไม่
const isInCart = computed(() => {
    if (!product.value || !currentUnit.value) return false;
    const productCode = product.value.id || product.value.code;
    const unitCode = currentUnit.value.unit_code;
    return cartStore.cartItems.some((item) => item.item_code === productCode && item.unit_code === unitCode);
});

// จำนวนที่มีในตะกร้า
const quantityInCart = computed(() => {
    if (!product.value || !currentUnit.value) return 0;
    const productCode = product.value.id || product.value.code;
    const unitCode = currentUnit.value.unit_code;
    return cartStore.cartItems.filter((item) => item.item_code === productCode && item.unit_code === unitCode).reduce((total, item) => total + parseInt(item.qty || 0), 0);
});

// หน่วยสินค้าที่กำลังเลือก
const currentUnit = computed(() => {
    if (!product.value || !product.value.otherUnits) return null;

    let unit;
    if (selectedUnitIndex.value === 0) {
        unit = {
            unit_code: product.value.unit_code,
            price: product.value.price,
            sold_out: product.value.sold_out,
            balance_qty: product.value.balance_qty,
            minimum_qty: product.value.minimum_qty,
            maximum_qty: product.value.maximum_qty,
            sum_sale: product.value.sum_sale
        };
    } else {
        unit = product.value.otherUnits[selectedUnitIndex.value - 1];
    }

    return unit;
});

// คำนวณยอดรวมคงเหลือจากทุก location
const totalStockBalance = computed(() => {
    return stockLocations.value.reduce((sum, loc) => sum + parseFloat(loc.balance_qty || 0), 0);
});

// ตรวจสอบว่าสามารถเพิ่มลงตะกร้าได้หรือไม่
const canAddToCart = computed(() => {
    return orderQuantity.value > 0;
});

function goToLogin() {
    router.push('/auth/login');
}

// ฟังก์ชันสำหรับจัดรูปแบบตัวเลข
function formatNumber(value) {
    const num = parseFloat(value);
    return num.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

onMounted(async () => {
    try {
        loading.value = true;
        await fetchProductDetail();
    } catch (error) {
        console.error('Error fetching data:', error);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้', life: 3000 });
    } finally {
        loading.value = false;
    }
});

// ดึงข้อมูลสินค้า
async function fetchProductDetail() {
    const itemCode = route.params.id;
    if (!itemCode) {
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่พบรหัสสินค้า', life: 3000 });
        return;
    }

    try {
        const result = await ProductService.getProductByItemCode(itemCode);
        product.value = result.data;

        // ดึงรูปภาพ
        await fetchProductImages();
        // ดึงสต็อก
        await fetchProductStock();
    } catch (error) {
        console.error('Error fetching product detail:', error);
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถโหลดข้อมูลสินค้าได้', life: 3000 });
    }
}

// ดึงรายการรูปภาพของสินค้า
async function fetchProductImages() {
    if (!product.value || !product.value.code) {
        images.value = [{ itemImageSrc: ProductService.getPlaceholderImage(), thumbnailImageSrc: ProductService.getPlaceholderImage(), alt: product.value ? product.value.name : 'สินค้า' }];
        return;
    }

    try {
        const imageList = await ProductService.getImageList(product.value.code);
        if (imageList && imageList.length > 0) {
            images.value = imageList.map((imageData) => ({
                itemImageSrc: ProductService.getProductImageByGuid(imageData.guid_code),
                thumbnailImageSrc: ProductService.getProductImageByGuid(imageData.guid_code),
                alt: product.value.name,
                guid_code: imageData.guid_code
            }));
        } else {
            images.value = [{ itemImageSrc: ProductService.getPlaceholderImage(), thumbnailImageSrc: ProductService.getPlaceholderImage(), alt: product.value.name }];
        }
    } catch (error) {
        console.error('Error fetching product images:', error);
        images.value = [{ itemImageSrc: ProductService.getPlaceholderImage(), thumbnailImageSrc: ProductService.getPlaceholderImage(), alt: product.value.name }];
    }
}

// ดึงข้อมูลสต็อกตาม location
async function fetchProductStock() {
    if (!product.value || !product.value.code || !currentUnit.value) return;

    loadingStock.value = true;
    try {
        const result = await ProductService.getProductStock(product.value.code, currentUnit.value.unit_code);
        stockLocations.value = result.data && result.data.length > 0 ? result.data : [];
    } catch (error) {
        console.error('Error fetching product stock:', error);
        stockLocations.value = [];
    } finally {
        loadingStock.value = false;
    }
}

function addToCart() {
    if (!product.value || !canAddToCart.value) return;

    const unit = currentUnit.value;
    const qty = parseInt(orderQuantity.value) || 0;
    if (qty <= 0) return;

    addingToCart.value = true;

    const cartItem = {
        id: `${product.value.code}_${unit.unit_code}`,
        item_code: product.value.code,
        code: product.value.code,
        name: product.value.name,
        item_name: product.value.name,
        price: parseFloat(unit.price) || 0,
        image: product.value.image,
        category: product.value.category || '',
        unit: unit.unit_code,
        unit_code: unit.unit_code,
        barcode: product.value.barcode || '',
        wh_code: localStorage.getItem('_warehouseCode') || '',
        shelf_code: '',
        location_name: ''
    };

    const existingCartItem = cartStore.cartItems.find((item) => item.item_code === cartItem.item_code && item.unit_code === cartItem.unit_code);
    const finalQty = existingCartItem ? parseInt(existingCartItem.qty) + qty : qty;

    cartStore
        .addMultipleToCart([{ ...cartItem, qty: finalQty }])
        .then(() => {
            orderQuantity.value = 0;
        })
        .catch((err) => {
            console.error('Error adding to cart:', err);
            toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้', life: 3000 });
        })
        .finally(() => {
            addingToCart.value = false;
        });
}

// เปลี่ยนหน่วยสินค้า
async function changeUnit(index) {
    selectedUnitIndex.value = index;
    stockLocations.value = [];
    orderQuantity.value = 0;
    await fetchProductStock();
}

function goBack() {
    router.go(-1);
}

// ฟังก์ชันเปลี่ยนสถานะรายการโปรด
function toggleFavorite() {
    if (!product.value) return;

    const oldFavoriteStatus = product.value.favorite_item || '0';
    product.value.favorite_item = product.value.favorite_item === '1' ? '0' : '1';

    ProductService.updateFavoriteStatus(product.value.id || product.value.code, product.value.favorite_item).catch((error) => {
        console.error('Error updating favorite status:', error);
        product.value.favorite_item = oldFavoriteStatus;
        toast.add({ severity: 'error', summary: 'เกิดข้อผิดพลาด', detail: 'ไม่สามารถอัปเดตสถานะรายการโปรดได้', life: 3000 });
    });
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
    <div>
        <Toast position="top-right" />

        <!-- Header with back button -->
        <header class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm p-3 sm:p-4 flex items-center">
            <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="goBack" class="mr-2" />
            <h1 class="text-sm sm:text-lg font-semibold truncate flex-1">
                {{ product ? product.name : 'รายละเอียดสินค้า' }}
            </h1>
            <div class="flex gap-2">
                <div v-if="product" class="rounded-full w-8 h-8 flex items-center justify-center cursor-pointer" :class="product.favorite_item === '1' ? 'bg-red-500' : 'bg-white dark:bg-gray-700'" @click="toggleFavorite">
                    <i class="pi" :class="product.favorite_item === '1' ? 'pi-heart-fill text-white' : 'pi-heart text-gray-600 dark:text-gray-200'" style="font-size: 1rem"></i>
                </div>
            </div>
        </header>

        <!-- Loading state -->
        <div v-if="loading" class="flex justify-center items-center p-6 min-h-[50vh]">
            <ProgressSpinner style="width: 50px" />
        </div>

        <div v-else-if="product" class="pb-20 sm:pb-24">
            <!-- Product content -->
            <div class="md:flex">
                <!-- Product gallery -->
                <div class="md:w-1/2 relative pt-2 sm:p-5 md:p-6">
                    <Galleria
                        v-if="images.length > 0"
                        :value="images"
                        :numVisible="4"
                        :circular="true"
                        :showThumbnails="images.length > 1"
                        :showItemNavigators="images.length > 1"
                        :responsiveOptions="galleryOptions"
                        containerClass="w-full"
                    >
                        <template #item="slotProps">
                            <div class="flex justify-center items-center bg-gray-50 dark:bg-gray-800 rounded-lg" style="height: 300px">
                                <img :src="slotProps.item.itemImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = ProductService.getPlaceholderImage()" class="max-w-full max-h-full object-contain rounded-lg" style="max-height: 280px" />
                            </div>
                        </template>
                        <template #thumbnail="slotProps">
                            <img :src="slotProps.item.thumbnailImageSrc" :alt="slotProps.item.alt" @error="$event.target.src = ProductService.getPlaceholderImage()" class="rounded-sm object-cover" style="width: 70px; height: 50px" />
                        </template>
                    </Galleria>

                    <!-- ถ้าไม่มีรูปภาพ ให้แสดงรูปภาพสำรอง -->
                    <div v-else class="w-full h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <img :src="ProductService.getPlaceholderImage()" :alt="product.name" class="max-h-[250px] max-w-full object-contain" />
                    </div>
                </div>

                <!-- Product info card -->
                <div class="product-info pt-2 sm:p-5 md:p-6 md:w-1/2">
                    <Card class="product-info-card shadow-sm border-none">
                        <template #content>
                            <div class="mb-4">
                                <div class="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                                    รหัสสินค้า: <span class="font-medium">{{ product.code }}</span>
                                </div>
                                <h2 class="text-xl sm:text-2xl font-bold mt-2">{{ product.name }}</h2>
                            </div>

                            <Divider />

                            <!-- เลือกหน่วย -->
                            <div class="mb-3">
                                <div class="text-base font-medium mb-2">เลือกหน่วย:</div>
                                <div class="flex flex-wrap gap-2">
                                    <Button :label="product.unit_code" :outlined="selectedUnitIndex !== 0" @click="changeUnit(0)" class="text-md" />
                                    <Button v-for="(unitItem, idx) in product.otherUnits" :key="idx" :label="unitItem.unit_code" :outlined="selectedUnitIndex !== idx + 1" @click="changeUnit(idx + 1)" class="text-sm" size="small" />
                                </div>
                            </div>

                            <!-- ราคา / Min / Max ตามหน่วยที่เลือก -->
                            <div v-if="currentUnit" class="mb-4 text-sm text-gray-700 dark:text-gray-300 flex flex-wrap gap-4">
                                <span>ราคา: <strong class="text-primary">฿{{ parseFloat(currentUnit.price || 0).toLocaleString() }}</strong> / {{ currentUnit.unit_code }}</span>
                                <span>สั่งซื้อต่ำสุด: <strong>{{ parseFloat(currentUnit.minimum_qty) > 0 ? formatNumber(parseFloat(currentUnit.minimum_qty)) : '-' }}</strong></span>
                                <span>สั่งซื้อสูงสุด: <strong>{{ parseFloat(currentUnit.maximum_qty) > 0 ? formatNumber(parseFloat(currentUnit.maximum_qty)) : '-' }}</strong></span>
                            </div>

                            <!-- Loading stock -->
                            <div v-if="loadingStock" class="flex flex-col justify-center items-center p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg mb-4">
                                <ProgressSpinner style="width: 36px; height: 36px" />
                                <span class="mt-2 text-gray-500 dark:text-gray-400 text-sm">กำลังโหลดข้อมูลสต็อก...</span>
                            </div>

                            <!-- In cart badge -->
                            <div v-if="isInCart" class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 p-3 rounded-lg text-base mb-4 flex items-center">
                                <i class="pi pi-info-circle mr-2"></i>
                                <span>มีในตะกร้าแล้ว <Badge :value="quantityInCart" severity="info" class="ml-1"></Badge></span>
                            </div>

                            <!-- Stock locations table - แสดงยอดคงเหลือตามที่เก็บ -->
                            <div class="mb-4" v-if="isLoggedIn && stockLocations.length > 0">
                                <div class="text-base font-medium mb-2">ยอดคงเหลือตามที่เก็บ:</div>
                                <div class="bg-gray-50 dark:bg-gray-800/30 rounded-lg overflow-hidden">
                                    <!-- Header -->
                                    <div class="grid grid-cols-2 gap-2 p-3 bg-gray-100 dark:bg-gray-700 font-medium text-sm">
                                        <div class="text-center">ที่เก็บ</div>
                                        <div class="text-center">คงเหลือ</div>
                                    </div>
                                    <!-- Rows -->
                                    <div
                                        v-for="(loc, index) in stockLocations"
                                        :key="loc.location"
                                        :class="['grid grid-cols-2 gap-2 p-3 items-center', index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50']"
                                    >
                                        <div class="text-center">
                                            <span class="font-medium text-xs text-gray-700 dark:text-gray-300">{{ loc.warehouse_name }} | {{ loc.location_name }}</span>
                                        </div>
                                        <div class="text-center">
                                            <span class="font-medium">{{ parseInt(loc.balance_qty) }}</span>
                                        </div>
                                    </div>
                                    <!-- Total -->
                                    <div class="grid grid-cols-2 gap-2 p-3 bg-gray-100 dark:bg-gray-700 font-medium border-t text-sm">
                                        <div class="text-center">รวม</div>
                                        <div class="text-center">{{ totalStockBalance }}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- จำนวนสั่งซื้อ -->
                            <div class="mb-4" v-if="isLoggedIn">
                                <div class="text-base font-medium mb-2">จำนวนสั่งซื้อ:</div>
                                <div class="flex items-center gap-2">
                                    <Button
                                        icon="pi pi-minus"
                                        text
                                        rounded
                                        size="small"
                                        @click="orderQuantity > 0 ? orderQuantity-- : null"
                                        :disabled="orderQuantity <= 0"
                                        class="w-10 h-10 border border-gray-300 dark:border-gray-600"
                                    />
                                    <input
                                        type="text"
                                        v-model="orderQuantity"
                                        class="w-20 text-center font-medium text-lg border border-gray-300 dark:border-gray-600 rounded px-2 py-2 bg-white dark:bg-gray-700"
                                        @keydown="handleQuantityKeydown"
                                    />
                                    <Button
                                        icon="pi pi-plus"
                                        text
                                        rounded
                                        size="small"
                                        @click="orderQuantity++"
                                        class="w-10 h-10 border border-gray-300 dark:border-gray-600"
                                    />
                                    <span class="text-gray-500 text-sm ml-1">{{ currentUnit?.unit_code }}</span>
                                </div>
                            </div>

                            <Divider />

                            <!-- Action Buttons -->
                            <div class="gap-3 mt-4">
                                <Button
                                    v-if="isLoggedIn"
                                    icon="pi pi-shopping-cart"
                                    :label="`เพิ่มลงตะกร้า${orderQuantity > 0 ? ' (' + orderQuantity + ')' : ''}`"
                                    @click="addToCart"
                                    :disabled="!canAddToCart"
                                    :loading="addingToCart"
                                    class="w-full flex items-center justify-center"
                                />
                                <Button v-else icon="pi pi-sign-in" label="เข้าสู่ระบบเพื่อสั่งซื้อ" @click="goToLogin" class="w-full p-button-outlined flex items-center justify-center" />
                            </div>
                        </template>
                    </Card>
                </div>
            </div>
        </div>

        <div v-else class="p-4 text-center">
            <div class="text-gray-500">ไม่พบข้อมูลสินค้า</div>
        </div>
    </div>
</template>

<style scoped>
:deep(.p-galleria) {
    background: transparent;
    border: none;
}

:deep(.p-galleria-thumbnail-container) {
    background-color: rgba(0, 0, 0, 0.03);
    padding: 0.5rem 0;
}

:deep(.p-galleria-thumbnail-item-active) {
    border: 2px solid var(--primary-color) !important;
}

:deep(.p-galleria-thumbnail-item) {
    opacity: 0.7;
    transition: all 0.2s;
}

:deep(.p-galleria-thumbnail-item:hover),
:deep(.p-galleria-thumbnail-item-active) {
    opacity: 1;
}

.overflow-x-auto::-webkit-scrollbar {
    height: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
}

.cursor-pointer {
    transition: all 0.2s ease;
}
</style>
