// services/SupplierService.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API || 'http://43.229.149.11:8998/WawaShopService',
    headers: {
        'Content-Type': 'application/json'
    }
});

export default {
    /**
     * ดึงรายการเจ้าหนี้ตามคำค้นหา
     * @param {string} search คำค้นหา (ชื่อหรือรหัสเจ้าหนี้)
     * @param {number} limit จำนวนรายการสูงสุดที่ต้องการ
     * @returns {Promise} รายการเจ้าหนี้ที่ตรงกับคำค้นหา
     */
    getSuppliers(search = '', limit = null) {
        return new Promise((resolve, reject) => {
            apiClient
                .get('/getSupplierList', {
                    params: {
                        search: search
                    }
                })
                .then((response) => {
                    let results = [];

                    if (response.data && Array.isArray(response.data)) {
                        results = response.data;
                    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
                        results = response.data.data;
                    } else {
                        console.warn('รูปแบบข้อมูลไม่ตรงตามที่คาดหวัง:', response.data);
                        results = [];
                    }

                    if (limit && Number(limit) > 0 && results.length > Number(limit)) {
                        results = results.slice(0, Number(limit));
                    }

                    resolve(results);
                })
                .catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการเรียก API ค้นหาเจ้าหนี้:', error);
                    reject(error);
                });
        });
    }
};
