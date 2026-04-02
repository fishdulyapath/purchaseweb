// services/BalanceService.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default {
    /**
     * ดึงรายการสินค้าคงเหลือ (Lite) — ไม่ query ราคา/stock หนัก → เร็ว
     */
    getBalanceListLite(params = {}) {
        return apiClient.get('/getBalanceListLite', {
            params: {
                search: params.search || '',
                warehouse: params.warehouse || '',
                shelf_from: params.shelfFrom || '',
                shelf_to: params.shelfTo || '',
                groupsub: params.groupSub || '',
                groupsub2: params.groupSub2 || '',
                brand: params.brand || '',
                model: params.model || '',
                category2: params.category || '',
                format: params.format || '',
                sort: params.sort || 'asc',
                sort_col: params.sortCol || '',
                offset: params.offset || 0,
                limit: params.limit || 30,
                stockfilter: params.stockfilter || 'all',
                qty_from: params.qty_from || '',
                qty_to: params.qty_to || '',
                price_from: params.price_from || '',
                price_to: params.price_to || ''
            }
        });
    },

    /**
     * ดึงรายละเอียดคลัง/ที่เก็บของสินค้า
     */
    getBalanceDetail(itemCode, shelfList = '', warehouse = '') {
        return apiClient.get('/getBalanceDetail', {
            params: {
                item_code: itemCode,
                shelf_list: shelfList,
                warehouse: warehouse
            }
        });
    },

    /**
     * Lazy load ราคาสำหรับ detail row (expansion) — per item_code + location
     */
    getBalanceDetailPrice(itemCode, location = '', unitCode = '', custCode = '', saleType = '1') {
        return apiClient.get('/getBalanceDetailPrice', {
            params: {
                item_code: itemCode,
                location: location,
                unit_code: unitCode,
                cust_code: custCode,
                sale_type: saleType
            }
        });
    },

    getSearchWarehouseList() {
        return apiClient.get('/getSearchWarehouseList');
    },

    getSearchShelfList() {
        return apiClient.get('/getSearchShelfList');
    },

    getSearchGroupSubList() {
        return apiClient.get('/getSearchGroupSubList');
    },

    getSearchGroupSub2List() {
        return apiClient.get('/getSearchGroupSub2List');
    },

    getSearchBrandList() {
        return apiClient.get('/getSearchBrandList');
    },

    getSearchModelList() {
        return apiClient.get('/getSearchModelList');
    },

    getSearchCategoryList() {
        return apiClient.get('/getSearchCategoryList');
    },

    getSearchFormatList() {
        return apiClient.get('/getSearchFormatList');
    }
};
