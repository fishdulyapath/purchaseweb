<script setup>
import { onMounted } from 'vue';
import { useCartStore } from '@/stores/cartStore';
import CatalogTable from '@/components/catalog/CatalogTable.vue';

const cartStore = useCartStore();

onMounted(async () => {
    await cartStore.loadCartItems();
});
</script>

<template>
    <div class="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Toast />
        <CatalogTable />
    </div>
</template>
