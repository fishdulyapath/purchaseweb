# order-online-krabi

Sakai is an application template for Vue based on the [create-vue](https://github.com/vuejs/create-vue), the recommended way to start a Vite-powered Vue projects.

Visit the [documentation](https://sakai.primevue.org/documentation) to get started.


CREATE TABLE public.ps_cart_order_temp
(
  roworder serial,
  cust_code character varying(255),
  guid_code character varying(255),
  item_code character varying(255),
  unit_code character varying(255),
  qty numeric DEFAULT 0,
  create_datetime timestamp without time zone DEFAULT now(),
  price numeric DEFAULT 0,
  wh_code character varying(255),
  shelf_code character varying(255),
  creator_code character varying(255),
  barcode character varying(255),
  item_name character varying(255),
  stand_value numeric DEFAULT 1,
  divide_value numeric DEFAULT 1,
  ratio numeric DEFAULT 1,
  CONSTRAINT ps_cart_order_temp_pk PRIMARY KEY (roworder)
)

CREATE TABLE emp_permission (
    id          serial,
    emp_code    character varying(255) NOT NULL,
    screen_code character varying(255) NOT NULL, 
    is_allow    smallint  NOT NULL DEFAULT 1,
    created_by  character varying(255),
    created_at  timestamp without time zone DEFAULT now(),
    updated_at  timestamp without time zone DEFAULT now(),
    CONSTRAINT uq_emp_screen_pk PRIMARY KEY (emp_code, screen_code)
);
