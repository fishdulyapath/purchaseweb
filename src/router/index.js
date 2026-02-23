import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(import.meta.env.VITE_APP_BASE_URL),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/',
                    name: 'catalog',
                    meta: { title: 'สินค้า', requiresAuth: true },

                    component: () => import('@/views/pages/Catalog.vue')
                },

                // หน้ารายละเอียดสินค้า
                {
                    path: '/product-detail/:id',
                    name: 'product-detail',
                    component: () => import('@/views/pages/ProductDetail.vue'),
                    props: true
                },
                // หน้าตะกร้าสินค้า
                {
                    path: '/cart',
                    name: 'cart',
                    component: () => import('@/views/pages/CartView.vue')
                },

                // อนุมัติเสนอซื้อ (PR)
                {
                    path: 'pr-approve',
                    name: 'pr-approve',
                    component: () => import('@/views/pages/PRApprove.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'อนุมัติเสนอซื้อ',
                        permissionKey: 'pr_approve'
                    }
                },
                // ประวัติเสนอซื้อ
                {
                    path: 'pr-history',
                    name: 'pr-history',
                    component: () => import('@/views/pages/PRHistory.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'ประวัติเสนอซื้อ'
                    }
                },
                // ใบสั่งซื้อ PO
                {
                    path: 'po-list',
                    name: 'po-list',
                    component: () => import('@/views/pages/POList.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'ใบสั่งซื้อ',
                        permissionKey: 'po'
                    }
                },
                // สร้าง PO
                {
                    path: 'po-create',
                    name: 'po-create',
                    component: () => import('@/views/pages/POCreate.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'สร้างใบสั่งซื้อ',
                        permissionKey: 'po'
                    }
                },
                // ใบรับสินค้า PU
                {
                    path: 'pu-list',
                    name: 'pu-list',
                    component: () => import('@/views/pages/PUList.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'ใบรับสินค้า',
                        permissionKey: 'pu'
                    }
                },
                // สร้างใบรับสินค้า PU
                {
                    path: 'pu-create',
                    name: 'pu-create',
                    component: () => import('@/views/pages/PUCreate.vue'),
                    meta: {
                        requiresAuth: true,
                        title: 'สร้างใบรับสินค้า',
                        permissionKey: 'pu'
                    }
                },
                // กำหนดสิทธิ์
                {
                    path: 'permission-manage',
                    name: 'permission-manage',
                    component: () => import('@/views/pages/PermissionManage.vue'),
                    meta: {
                        requiresAuth: true,
                        requiresSuperAdmin: true,
                        title: 'กำหนดสิทธิ์'
                    }
                }
            ]
        },
        {
            path: '/landing',
            name: 'landing',
            component: () => import('@/views/pages/Landing.vue')
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },

        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/pages/notfound'
        }
    ]
});

// guard
router.beforeEach((to, from, next) => {
    const isAuthenticated = localStorage.getItem('_token');

    if (to.meta.requiresAuth && !isAuthenticated) {
        next({ name: 'login' });
        return;
    }

    // superadmin only pages
    if (to.meta.requiresSuperAdmin) {
        const empCode = (localStorage.getItem('_empCode') || '').toUpperCase();
        if (empCode !== 'SUPERADMIN') {
            next({ name: 'accessDenied' });
            return;
        }
    }

    // permission-based pages
    if (to.meta.permissionKey) {
        const empCode = (localStorage.getItem('_empCode') || '').toUpperCase();
        // superadmin ข้ามการตรวจสิทธิ์
        if (empCode !== 'SUPERADMIN') {
            let allowed = false;
            try {
                const permsStr = localStorage.getItem('_empPermissions');
                if (permsStr) {
                    const perms = JSON.parse(permsStr);
                    allowed = perms[to.meta.permissionKey] === 1;
                }
            } catch (e) {
                allowed = false;
            }
            if (!allowed) {
                next({ name: 'accessDenied' });
                return;
            }
        }
    }

    document.title = to.meta.title ? to.meta.title + ' - ' + import.meta.env.VITE_APP_NAME : import.meta.env.VITE_APP_NAME;
    next();
});

export default router;
