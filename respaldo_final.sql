--
-- PostgreSQL database dump
--


-- Dumped from database version 16.12
-- Dumped by pg_dump version 16.12

-- Started on 2026-03-30 23:58:19



--
-- TOC entry 7 (class 2615 OID 26818)
-- Name: inventario; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA inventario;




--
-- TOC entry 6 (class 2615 OID 26817)
-- Name: pos; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA pos;




--
-- TOC entry 918 (class 1247 OID 26878)
-- Name: caja_estado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.caja_estado AS ENUM (
    'abierta',
    'cerrada'
);




--
-- TOC entry 921 (class 1247 OID 26884)
-- Name: caja_mov_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.caja_mov_tipo AS ENUM (
    'apertura',
    'venta',
    'retiro',
    'gasto',
    'cierre',
    'ingreso'
);




--
-- TOC entry 909 (class 1247 OID 26838)
-- Name: item_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_tipo AS ENUM (
    'entrada',
    'fondo',
    'bebida',
    'postre',
    'snack',
    'insumo',
    'preparado',
    'empacado'
);




--
-- TOC entry 924 (class 1247 OID 26896)
-- Name: kardex_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kardex_tipo AS ENUM (
    'compra',
    'venta',
    'salida_cocina',
    'ajuste',
    'merma',
    'reversion'
);




--
-- TOC entry 906 (class 1247 OID 26828)
-- Name: mesa_estado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.mesa_estado AS ENUM (
    'libre',
    'ocupada',
    'reservada',
    'mantenimiento'
);




--
-- TOC entry 912 (class 1247 OID 26852)
-- Name: orden_estado; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.orden_estado AS ENUM (
    'abierta',
    'enviada_cocina',
    'preparando',
    'lista',
    'cobrada',
    'cancelada'
);




--
-- TOC entry 915 (class 1247 OID 26866)
-- Name: pago_metodo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.pago_metodo AS ENUM (
    'efectivo',
    'tarjeta',
    'yape',
    'plin',
    'mixto'
);




--
-- TOC entry 903 (class 1247 OID 26820)
-- Name: rol_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.rol_tipo AS ENUM (
    'administrador',
    'cajero',
    'mesero'
);




--
-- TOC entry 927 (class 1247 OID 26910)
-- Name: ticket_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ticket_tipo AS ENUM (
    'pedido_cocina',
    'venta_cliente'
);




--
-- TOC entry 930 (class 1247 OID 26916)
-- Name: turno_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.turno_tipo AS ENUM (
    'manana',
    'tarde',
    'noche'
);




--
-- TOC entry 284 (class 1255 OID 27415)
-- Name: fn_kardex_movimiento(integer, public.kardex_tipo, numeric, character varying, integer, character varying, integer, numeric, integer); Type: FUNCTION; Schema: inventario; Owner: postgres
--

CREATE FUNCTION inventario.fn_kardex_movimiento(p_producto_id integer, p_tipo public.kardex_tipo, p_cantidad numeric, p_referencia_tipo character varying, p_referencia_id integer, p_referencia character varying, p_usuario_id integer, p_costo_unitario numeric DEFAULT NULL::numeric, p_reversion_de integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$  -- Retorna el ID del kardex insertado
DECLARE
    v_stock_actual          DECIMAL(10,3);
    v_stock_nuevo           DECIMAL(10,3);
    v_controla_stock        BOOLEAN;
    v_permite_negativo      BOOLEAN;
    v_stock_minimo          DECIMAL(10,3);
    v_nombre                VARCHAR(150);
    v_kardex_id             INT;
BEGIN
    -- Bloquear la fila del producto para evitar race conditions
    SELECT stock_actual, control_stock, permite_stock_negativo, stock_minimo, nombre
    INTO   v_stock_actual,  v_controla_stock,  v_permite_negativo,  v_stock_minimo, v_nombre
    FROM   inventario.productos
    WHERE  id = p_producto_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado', p_producto_id;
    END IF;

    -- Si no controla stock: registrar en kardex sin tocar stock
    IF v_controla_stock = FALSE THEN
        v_stock_nuevo := v_stock_actual;
    ELSE
        -- Calcular nuevo stock según dirección del movimiento
        IF p_tipo IN ('compra', 'ajuste', 'reversion') THEN
            v_stock_nuevo := v_stock_actual + ABS(p_cantidad);
        ELSE
            v_stock_nuevo := v_stock_actual - ABS(p_cantidad);
        END IF;

        -- Validar stock negativo
        IF v_stock_nuevo < 0 AND v_permite_negativo = FALSE THEN
            RAISE EXCEPTION
                'Stock insuficiente para "%" (id: %). Disponible: % %, se intenta descontar: % %.'
                ' Active permite_stock_negativo si desea continuar.',
                v_nombre, p_producto_id,
                v_stock_actual, (SELECT unidad_medida FROM inventario.productos WHERE id = p_producto_id),
                ABS(p_cantidad), (SELECT unidad_medida FROM inventario.productos WHERE id = p_producto_id);
        END IF;
    END IF;

    -- Insertar en kardex
    INSERT INTO inventario.kardex (
        producto_id, tipo_movimiento, cantidad,
        stock_anterior, stock_nuevo, costo_unitario,
        referencia_tipo, referencia_id, referencia,
        usuario_id, reversion_de
    ) VALUES (
        p_producto_id, p_tipo, ABS(p_cantidad),
        v_stock_actual, v_stock_nuevo, p_costo_unitario,
        p_referencia_tipo, p_referencia_id, p_referencia,
        p_usuario_id, p_reversion_de
    )
    RETURNING id INTO v_kardex_id;

    -- Actualizar stock en producto si controla stock
    IF v_controla_stock = TRUE THEN
        UPDATE inventario.productos
        SET    stock_actual = v_stock_nuevo
               -- updated_at lo maneja el trigger trg_before_producto_update
        WHERE  id = p_producto_id;
    END IF;

    -- CORRECCIÓN #3: Registrar alertas automáticas
    IF v_controla_stock = TRUE THEN
        -- Alerta de stock negativo
        IF v_stock_nuevo < 0 THEN
            INSERT INTO inventario.alertas_stock (
                producto_id, tipo_alerta, stock_en_alerta, stock_minimo,
                referencia_tipo, referencia_id, usuario_id
            ) VALUES (
                p_producto_id, 'stock_negativo', v_stock_nuevo, v_stock_minimo,
                p_referencia_tipo, p_referencia_id, p_usuario_id
            );
        -- Alerta de stock bajo (solo si no es ya negativo)
        ELSIF v_stock_nuevo <= v_stock_minimo AND v_stock_minimo > 0 THEN
            INSERT INTO inventario.alertas_stock (
                producto_id, tipo_alerta, stock_en_alerta, stock_minimo,
                referencia_tipo, referencia_id, usuario_id
            ) VALUES (
                p_producto_id, 'stock_bajo', v_stock_nuevo, v_stock_minimo,
                p_referencia_tipo, p_referencia_id, p_usuario_id
            );
        END IF;
    END IF;

    RETURN v_kardex_id;
END;
$$;




--
-- TOC entry 285 (class 1255 OID 27416)
-- Name: fn_revertir_kardex(integer, integer, character varying); Type: FUNCTION; Schema: inventario; Owner: postgres
--

CREATE FUNCTION inventario.fn_revertir_kardex(p_kardex_id integer, p_usuario_id integer, p_motivo character varying DEFAULT 'Reversión manual'::character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_k         inventario.kardex%ROWTYPE;
    v_tipo_rev  kardex_tipo;
BEGIN
    SELECT * INTO v_k FROM inventario.kardex WHERE id = p_kardex_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimiento de kardex % no encontrado', p_kardex_id;
    END IF;
    IF v_k.reversion_de IS NOT NULL THEN
        RAISE EXCEPTION 'El movimiento % ya es una reversión, no se puede revertir de nuevo', p_kardex_id;
    END IF;

    -- El movimiento de reversión siempre es tipo 'reversion' (suma al stock)
    RETURN inventario.fn_kardex_movimiento(
        v_k.producto_id,
        'reversion',
        v_k.cantidad,
        'reversion',
        p_kardex_id,
        p_motivo,
        p_usuario_id,
        NULL,
        p_kardex_id  -- reversion_de
    );
END;
$$;




--
-- TOC entry 287 (class 1255 OID 27419)
-- Name: trg_compra_detalle_kardex(); Type: FUNCTION; Schema: inventario; Owner: postgres
--

CREATE FUNCTION inventario.trg_compra_detalle_kardex() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_usuario_id INT;
    v_nombre     VARCHAR(150);
BEGIN
    SELECT usuario_id INTO v_usuario_id FROM inventario.compras WHERE id = NEW.compra_id;
    SELECT nombre INTO v_nombre FROM inventario.productos WHERE id = NEW.producto_id;

    PERFORM inventario.fn_kardex_movimiento(
        NEW.producto_id,
        'compra',
        NEW.cantidad,
        'compra',
        NEW.compra_id,
        'Compra #' || NEW.compra_id || ' - ' || v_nombre,
        v_usuario_id,
        NEW.costo_unitario
    );

    RETURN NEW;
END;
$$;




--
-- TOC entry 270 (class 1255 OID 27022)
-- Name: trg_proteger_stock(); Type: FUNCTION; Schema: inventario; Owner: postgres
--

CREATE FUNCTION inventario.trg_proteger_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Solo validar si cambia stock_actual
    IF NEW.stock_actual <> OLD.stock_actual THEN
        -- Si el nuevo stock es negativo y el producto no lo permite: bloquear
        IF NEW.stock_actual < 0 AND NEW.permite_stock_negativo = FALSE AND NEW.control_stock = TRUE THEN
            RAISE EXCEPTION 
                'Stock insuficiente para producto % (%). Stock actual: %, solicitado bajarlo a: %. '
                'Si desea permitir stock negativo, active permite_stock_negativo en el producto.',
                NEW.nombre, NEW.id, OLD.stock_actual, NEW.stock_actual;
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;




--
-- TOC entry 288 (class 1255 OID 27421)
-- Name: trg_salida_cocina_aprobacion(); Type: FUNCTION; Schema: inventario; Owner: postgres
--

CREATE FUNCTION inventario.trg_salida_cocina_aprobacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_detalle RECORD;
    v_nombre  VARCHAR(150);
BEGIN
    -- Solo actuar cuando aprobado cambia de FALSE a TRUE
    IF OLD.aprobado = FALSE AND NEW.aprobado = TRUE THEN

        -- Registrar la fecha de aprobación si no viene del caller
        IF NEW.fecha_aprobacion IS NULL THEN
            NEW.fecha_aprobacion := NOW();
        END IF;

        -- Iterar sobre los detalles de esta salida
        FOR v_detalle IN
            SELECT scd.producto_id, scd.cantidad
            FROM   inventario.salidas_cocina_detalle scd
            WHERE  scd.salida_id = NEW.id AND scd.activo = TRUE
        LOOP
            SELECT nombre INTO v_nombre
            FROM inventario.productos WHERE id = v_detalle.producto_id;

            PERFORM inventario.fn_kardex_movimiento(
                v_detalle.producto_id,
                'salida_cocina',
                v_detalle.cantidad,
                'salida_cocina',
                NEW.id,
                'Salida Cocina #' || NEW.id || ' - ' || v_nombre,
                NEW.aprobado_por
            );
        END LOOP;

    -- Si intenta des-aprobar: bloquear (la reversión es explícita por admin)
    ELSIF OLD.aprobado = TRUE AND NEW.aprobado = FALSE THEN
        RAISE EXCEPTION 'No se puede des-aprobar una salida de cocina. Use fn_revertir_kardex para cada movimiento asociado.';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;




--
-- TOC entry 271 (class 1255 OID 27109)
-- Name: fn_validar_ciclo_menu(integer, integer); Type: FUNCTION; Schema: pos; Owner: postgres
--

CREATE FUNCTION pos.fn_validar_ciclo_menu(p_id integer, p_grupo_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_actual    INT := p_grupo_id;
    v_iteracion INT := 0;
BEGIN
    WHILE v_actual IS NOT NULL AND v_iteracion < 10 LOOP
        IF v_actual = p_id THEN
            RAISE EXCEPTION 'Ciclo detectado en grupo_menu_id: el ítem % ya es ancestro de %', p_id, p_grupo_id;
        END IF;
        SELECT grupo_menu_id INTO v_actual FROM pos.orden_detalles WHERE id = v_actual;
        v_iteracion := v_iteracion + 1;
    END LOOP;
END;
$$;




--
-- TOC entry 272 (class 1255 OID 27110)
-- Name: trg_validar_ciclo_menu_fn(); Type: FUNCTION; Schema: pos; Owner: postgres
--

CREATE FUNCTION pos.trg_validar_ciclo_menu_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.grupo_menu_id IS NOT NULL THEN
        PERFORM pos.fn_validar_ciclo_menu(NEW.id, NEW.grupo_menu_id);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;




--
-- TOC entry 286 (class 1255 OID 27417)
-- Name: trg_venta_detalle_kardex(); Type: FUNCTION; Schema: pos; Owner: postgres
--

CREATE FUNCTION pos.trg_venta_detalle_kardex() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cajero_id      INT;
    v_controla_stock BOOLEAN;
    v_nombre         VARCHAR(150);
BEGIN
    SELECT cajero_id INTO v_cajero_id FROM pos.ventas WHERE id = NEW.venta_id;

    SELECT control_stock, nombre INTO v_controla_stock, v_nombre
    FROM inventario.productos WHERE id = NEW.producto_id;

    -- Kardex solo si: controla stock Y no es ítem incluido de menú Y la línea está activa
    IF v_controla_stock = TRUE AND NEW.es_incluido_menu = FALSE AND NEW.activo = TRUE THEN
        PERFORM inventario.fn_kardex_movimiento(
            NEW.producto_id,
            'venta',
            NEW.cantidad,
            'venta',
            NEW.venta_id,
            'Venta #' || NEW.venta_id || ' - ' || v_nombre,
            v_cajero_id
        );
    END IF;

    RETURN NEW;
END;
$$;




--
-- TOC entry 289 (class 1255 OID 27423)
-- Name: fn_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;




--
-- TOC entry 267 (class 1255 OID 26926)
-- Name: gen_numero_comanda(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.gen_numero_comanda() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'C-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('seq_comanda')::TEXT, 4, '0');
END;
$$;




--
-- TOC entry 269 (class 1255 OID 26928)
-- Name: gen_numero_compra(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.gen_numero_compra() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'OC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('seq_compra')::TEXT, 4, '0');
END;
$$;




--
-- TOC entry 268 (class 1255 OID 26927)
-- Name: gen_numero_ticket(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.gen_numero_ticket() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'T-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('seq_ticket')::TEXT, 4, '0');
END;
$$;




SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 231 (class 1259 OID 27025)
-- Name: alertas_stock; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.alertas_stock (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo_alerta character varying(20) NOT NULL,
    stock_en_alerta numeric(10,3) NOT NULL,
    stock_minimo numeric(10,3) NOT NULL,
    referencia_tipo character varying(50),
    referencia_id integer,
    usuario_id integer,
    atendida boolean DEFAULT false NOT NULL,
    atendida_por integer,
    fecha_atencion timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT alertas_stock_tipo_alerta_check CHECK (((tipo_alerta)::text = ANY ((ARRAY['stock_bajo'::character varying, 'stock_negativo'::character varying])::text[])))
);




--
-- TOC entry 5378 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN alertas_stock.usuario_id; Type: COMMENT; Schema: inventario; Owner: postgres
--

COMMENT ON COLUMN inventario.alertas_stock.usuario_id IS 'Usuario que ejecutó la operación que disparó la alerta (trazabilidad de auditoría).';


--
-- TOC entry 5379 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN alertas_stock.atendida_por; Type: COMMENT; Schema: inventario; Owner: postgres
--

COMMENT ON COLUMN inventario.alertas_stock.atendida_por IS 'Usuario administrador que revisó y cerró la alerta.';


--
-- TOC entry 230 (class 1259 OID 27024)
-- Name: alertas_stock_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.alertas_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5380 (class 0 OID 0)
-- Dependencies: 230
-- Name: alertas_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.alertas_stock_id_seq OWNED BY inventario.alertas_stock.id;


--
-- TOC entry 227 (class 1259 OID 26982)
-- Name: categorias; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo public.item_tipo,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    color text DEFAULT '#3b82f6'::text NOT NULL
);




--
-- TOC entry 226 (class 1259 OID 26981)
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5381 (class 0 OID 0)
-- Dependencies: 226
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.categorias_id_seq OWNED BY inventario.categorias.id;


--
-- TOC entry 249 (class 1259 OID 27262)
-- Name: compras; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.compras (
    id integer NOT NULL,
    proveedor_id integer NOT NULL,
    usuario_id integer NOT NULL,
    numero_compra character varying(20) DEFAULT public.gen_numero_compra() NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text,
    fecha_emision date DEFAULT CURRENT_DATE NOT NULL,
    tipo_comprobante character varying(30) DEFAULT 'Nota de Venta'::character varying NOT NULL,
    serie_comprobante character varying(10),
    numero_comprobante character varying(20),
    igv numeric(10,2) DEFAULT 0 NOT NULL,
    metodo_pago character varying(20) DEFAULT 'efectivo'::character varying,
    caja_movimiento_id integer,
    CONSTRAINT compras_igv_check CHECK ((igv >= (0)::numeric)),
    CONSTRAINT compras_metodo_pago_check CHECK (((metodo_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'credito'::character varying])::text[]))),
    CONSTRAINT compras_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT compras_total_check CHECK ((total >= (0)::numeric))
);




--
-- TOC entry 5382 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN compras.numero_compra; Type: COMMENT; Schema: inventario; Owner: postgres
--

COMMENT ON COLUMN inventario.compras.numero_compra IS 'Correlativo interno del sistema (ej. COMP-0001)';


--
-- TOC entry 5383 (class 0 OID 0)
-- Dependencies: 249
-- Name: COLUMN compras.numero_comprobante; Type: COMMENT; Schema: inventario; Owner: postgres
--

COMMENT ON COLUMN inventario.compras.numero_comprobante IS 'Número del documento físico entregado por el proveedor';


--
-- TOC entry 251 (class 1259 OID 27291)
-- Name: compras_detalle; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.compras_detalle (
    id integer NOT NULL,
    compra_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    costo_unitario numeric(10,2) NOT NULL,
    subtotal numeric(10,2) GENERATED ALWAYS AS ((cantidad * costo_unitario)) STORED,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT compras_detalle_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT compras_detalle_costo_unitario_check CHECK ((costo_unitario >= (0)::numeric))
);




--
-- TOC entry 250 (class 1259 OID 27290)
-- Name: compras_detalle_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.compras_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5384 (class 0 OID 0)
-- Dependencies: 250
-- Name: compras_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.compras_detalle_id_seq OWNED BY inventario.compras_detalle.id;


--
-- TOC entry 248 (class 1259 OID 27261)
-- Name: compras_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.compras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5385 (class 0 OID 0)
-- Dependencies: 248
-- Name: compras_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.compras_id_seq OWNED BY inventario.compras.id;


--
-- TOC entry 257 (class 1259 OID 27358)
-- Name: kardex; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.kardex (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo_movimiento public.kardex_tipo NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    stock_anterior numeric(10,3) NOT NULL,
    stock_nuevo numeric(10,3) NOT NULL,
    costo_unitario numeric(10,2),
    referencia_tipo character varying(50),
    referencia_id integer,
    referencia character varying(100),
    usuario_id integer,
    reversion_de integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT kardex_cantidad_check CHECK ((cantidad > (0)::numeric))
);




--
-- TOC entry 5386 (class 0 OID 0)
-- Dependencies: 257
-- Name: TABLE kardex; Type: COMMENT; Schema: inventario; Owner: postgres
--

COMMENT ON TABLE inventario.kardex IS 'Inmutable: nunca se borra ni se marca inactivo. Las anulaciones se registran como tipo reversion con reversion_de apuntando al movimiento original.';


--
-- TOC entry 256 (class 1259 OID 27357)
-- Name: kardex_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.kardex_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5387 (class 0 OID 0)
-- Dependencies: 256
-- Name: kardex_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.kardex_id_seq OWNED BY inventario.kardex.id;


--
-- TOC entry 229 (class 1259 OID 26996)
-- Name: productos; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.productos (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    categoria_id integer NOT NULL,
    tipo public.item_tipo DEFAULT 'fondo'::public.item_tipo NOT NULL,
    precio_venta numeric(10,2) NOT NULL,
    costo_promedio numeric(10,2) DEFAULT 0 NOT NULL,
    control_stock boolean DEFAULT false NOT NULL,
    stock_actual numeric(10,3) DEFAULT 0 NOT NULL,
    stock_minimo numeric(10,3) DEFAULT 0 NOT NULL,
    permite_stock_negativo boolean DEFAULT false NOT NULL,
    unidad_medida character varying(20) DEFAULT 'unidad'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    disponible_en_menu boolean DEFAULT false NOT NULL,
    imagen_url text,
    CONSTRAINT productos_costo_promedio_check CHECK ((costo_promedio >= (0)::numeric)),
    CONSTRAINT productos_precio_venta_check CHECK ((precio_venta >= (0)::numeric)),
    CONSTRAINT productos_stock_minimo_check CHECK ((stock_minimo >= (0)::numeric))
);




--
-- TOC entry 5388 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN productos.permite_stock_negativo; Type: COMMENT; Schema: inventario; Owner: postgres
--

COMMENT ON COLUMN inventario.productos.permite_stock_negativo IS 'Si TRUE, fn_kardex_movimiento permite stock < 0 y genera alerta. Si FALSE, lanza excepción.';


--
-- TOC entry 228 (class 1259 OID 26995)
-- Name: productos_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5389 (class 0 OID 0)
-- Dependencies: 228
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.productos_id_seq OWNED BY inventario.productos.id;


--
-- TOC entry 247 (class 1259 OID 27248)
-- Name: proveedores; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.proveedores (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    ruc character varying(20),
    telefono character varying(20),
    direccion text,
    email character varying(100),
    tipo_producto character varying(100),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);




--
-- TOC entry 246 (class 1259 OID 27247)
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5390 (class 0 OID 0)
-- Dependencies: 246
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.proveedores_id_seq OWNED BY inventario.proveedores.id;


--
-- TOC entry 253 (class 1259 OID 27313)
-- Name: salidas_cocina; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.salidas_cocina (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    turno public.turno_tipo NOT NULL,
    observaciones text,
    aprobado boolean DEFAULT false NOT NULL,
    aprobado_por integer,
    fecha_aprobacion timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);




--
-- TOC entry 5391 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN salidas_cocina.aprobado; Type: COMMENT; Schema: inventario; Owner: postgres
--

COMMENT ON COLUMN inventario.salidas_cocina.aprobado IS 'El descuento de kardex ocurre SOLO cuando este campo cambia a TRUE (trigger BEFORE UPDATE).';


--
-- TOC entry 255 (class 1259 OID 27336)
-- Name: salidas_cocina_detalle; Type: TABLE; Schema: inventario; Owner: postgres
--

CREATE TABLE inventario.salidas_cocina_detalle (
    id integer NOT NULL,
    salida_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad numeric(10,3) NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT salidas_cocina_detalle_cantidad_check CHECK ((cantidad > (0)::numeric))
);




--
-- TOC entry 254 (class 1259 OID 27335)
-- Name: salidas_cocina_detalle_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.salidas_cocina_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5392 (class 0 OID 0)
-- Dependencies: 254
-- Name: salidas_cocina_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.salidas_cocina_detalle_id_seq OWNED BY inventario.salidas_cocina_detalle.id;


--
-- TOC entry 252 (class 1259 OID 27312)
-- Name: salidas_cocina_id_seq; Type: SEQUENCE; Schema: inventario; Owner: postgres
--

CREATE SEQUENCE inventario.salidas_cocina_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5393 (class 0 OID 0)
-- Dependencies: 252
-- Name: salidas_cocina_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: postgres
--

ALTER SEQUENCE inventario.salidas_cocina_id_seq OWNED BY inventario.salidas_cocina.id;


--
-- TOC entry 223 (class 1259 OID 26944)
-- Name: usuarios; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    usuario character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    correo character varying(150),
    rol_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT usuarios_correo_check CHECK (((correo)::text ~* '^[^@]+@[^@]+\.[^@]+$'::text)),
    CONSTRAINT usuarios_password_check CHECK ((length((password)::text) >= 60))
);




--
-- TOC entry 5394 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN usuarios.password; Type: COMMENT; Schema: pos; Owner: postgres
--

COMMENT ON COLUMN pos.usuarios.password IS 'Hash generado por la aplicación (bcrypt cost>=12 o Argon2id). NUNCA texto plano.';


--
-- TOC entry 5395 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN usuarios.correo; Type: COMMENT; Schema: pos; Owner: postgres
--

COMMENT ON COLUMN pos.usuarios.correo IS 'Opcional. Usado para recuperación de contraseña y notificaciones. Validado con regex básico en BD.';


--
-- TOC entry 265 (class 1259 OID 27458)
-- Name: v_alertas_pendientes; Type: VIEW; Schema: inventario; Owner: postgres
--

CREATE VIEW inventario.v_alertas_pendientes AS
 SELECT a.id,
    p.nombre AS producto,
    p.unidad_medida,
    a.tipo_alerta,
    a.stock_en_alerta,
    a.stock_minimo,
    a.referencia_tipo,
    a.referencia_id,
    u.nombre AS generada_por,
    a.created_at AS fecha_alerta
   FROM ((inventario.alertas_stock a
     JOIN inventario.productos p ON ((p.id = a.producto_id)))
     LEFT JOIN pos.usuarios u ON ((u.id = a.usuario_id)))
  WHERE (a.atendida = false)
  ORDER BY a.created_at DESC;




--
-- TOC entry 263 (class 1259 OID 27448)
-- Name: v_kardex_completo; Type: VIEW; Schema: inventario; Owner: postgres
--

CREATE VIEW inventario.v_kardex_completo AS
 SELECT k.id,
    p.nombre AS producto,
    p.tipo AS producto_tipo,
    k.tipo_movimiento,
    k.cantidad,
    k.stock_anterior,
    k.stock_nuevo,
    k.costo_unitario,
    k.referencia_tipo,
    k.referencia,
    u.nombre AS usuario_responsable,
    k.reversion_de,
    k.created_at AS fecha
   FROM ((inventario.kardex k
     JOIN inventario.productos p ON ((p.id = k.producto_id)))
     LEFT JOIN pos.usuarios u ON ((u.id = k.usuario_id)))
  ORDER BY k.created_at DESC;




--
-- TOC entry 237 (class 1259 OID 27113)
-- Name: ventas; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.ventas (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    cajero_id integer NOT NULL,
    numero_ticket character varying(20) DEFAULT public.gen_numero_ticket() NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    igv numeric(10,2) DEFAULT 0 NOT NULL,
    descuento numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    metodo_pago public.pago_metodo NOT NULL,
    monto_pagado numeric(10,2) NOT NULL,
    vuelto numeric(10,2) GENERATED ALWAYS AS ((monto_pagado - total)) STORED,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ventas_descuento_check CHECK ((descuento >= (0)::numeric)),
    CONSTRAINT ventas_igv_check CHECK ((igv >= (0)::numeric)),
    CONSTRAINT ventas_monto_pagado_check CHECK ((monto_pagado >= (0)::numeric)),
    CONSTRAINT ventas_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT ventas_total_check CHECK ((total >= (0)::numeric))
);




--
-- TOC entry 239 (class 1259 OID 27147)
-- Name: ventas_detalle; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.ventas_detalle (
    id integer NOT NULL,
    venta_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    precio numeric(10,2) NOT NULL,
    subtotal numeric(10,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio)) STORED,
    es_incluido_menu boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ventas_detalle_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT ventas_detalle_precio_check CHECK ((precio >= (0)::numeric))
);




--
-- TOC entry 262 (class 1259 OID 27443)
-- Name: v_productos_mas_vendidos; Type: VIEW; Schema: inventario; Owner: postgres
--

CREATE VIEW inventario.v_productos_mas_vendidos AS
 SELECT p.id,
    p.nombre,
    p.tipo,
    c.nombre AS categoria,
    sum(vd.cantidad) AS total_vendido,
    sum(vd.subtotal) AS total_ingresos,
    p.stock_actual
   FROM (((pos.ventas_detalle vd
     JOIN inventario.productos p ON ((p.id = vd.producto_id)))
     JOIN inventario.categorias c ON ((c.id = p.categoria_id)))
     JOIN pos.ventas v ON ((v.id = vd.venta_id)))
  WHERE ((v.activo = true) AND (vd.activo = true) AND (vd.es_incluido_menu = false))
  GROUP BY p.id, p.nombre, p.tipo, c.nombre, p.stock_actual
  ORDER BY (sum(vd.cantidad)) DESC
 LIMIT 50;




--
-- TOC entry 260 (class 1259 OID 27433)
-- Name: v_stock_bajo; Type: VIEW; Schema: inventario; Owner: postgres
--

CREATE VIEW inventario.v_stock_bajo AS
 SELECT p.id,
    p.nombre,
    p.tipo,
    p.stock_actual,
    p.stock_minimo,
    p.unidad_medida,
    p.permite_stock_negativo,
    (p.stock_minimo - p.stock_actual) AS unidades_faltantes,
    c.nombre AS categoria
   FROM (inventario.productos p
     JOIN inventario.categorias c ON ((c.id = p.categoria_id)))
  WHERE ((p.control_stock = true) AND (p.stock_actual <= p.stock_minimo) AND (p.activo = true))
  ORDER BY (p.stock_minimo - p.stock_actual) DESC;




--
-- TOC entry 241 (class 1259 OID 27170)
-- Name: caja_aperturas; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.caja_aperturas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    monto_inicial numeric(10,2) NOT NULL,
    estado public.caja_estado DEFAULT 'abierta'::public.caja_estado NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT caja_aperturas_monto_inicial_check CHECK ((monto_inicial >= (0)::numeric))
);




--
-- TOC entry 240 (class 1259 OID 27169)
-- Name: caja_aperturas_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.caja_aperturas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5396 (class 0 OID 0)
-- Dependencies: 240
-- Name: caja_aperturas_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.caja_aperturas_id_seq OWNED BY pos.caja_aperturas.id;


--
-- TOC entry 245 (class 1259 OID 27217)
-- Name: caja_cierres; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.caja_cierres (
    id integer NOT NULL,
    caja_id integer NOT NULL,
    usuario_id integer NOT NULL,
    total_ventas numeric(10,2) DEFAULT 0 NOT NULL,
    total_efectivo numeric(10,2) DEFAULT 0 NOT NULL,
    total_tarjeta numeric(10,2) DEFAULT 0 NOT NULL,
    total_otro numeric(10,2) DEFAULT 0 NOT NULL,
    total_retiros numeric(10,2) DEFAULT 0 NOT NULL,
    total_gastos numeric(10,2) DEFAULT 0 NOT NULL,
    monto_inicial numeric(10,2) DEFAULT 0 NOT NULL,
    monto_final_esperado numeric(10,2) GENERATED ALWAYS AS ((((monto_inicial + total_ventas) - total_retiros) - total_gastos)) STORED,
    monto_final_real numeric(10,2) NOT NULL,
    diferencia numeric(10,2) GENERATED ALWAYS AS ((monto_final_real - (((monto_inicial + total_ventas) - total_retiros) - total_gastos))) STORED,
    observaciones text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);




--
-- TOC entry 244 (class 1259 OID 27216)
-- Name: caja_cierres_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.caja_cierres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5397 (class 0 OID 0)
-- Dependencies: 244
-- Name: caja_cierres_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.caja_cierres_id_seq OWNED BY pos.caja_cierres.id;


--
-- TOC entry 243 (class 1259 OID 27189)
-- Name: caja_movimientos; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.caja_movimientos (
    id integer NOT NULL,
    caja_id integer NOT NULL,
    tipo public.caja_mov_tipo NOT NULL,
    descripcion text,
    monto numeric(10,2) NOT NULL,
    venta_id integer,
    usuario_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    referencia_tipo character varying(20),
    referencia_id integer,
    CONSTRAINT caja_movimientos_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT chk_venta_solo_en_tipo_venta CHECK (((venta_id IS NULL) OR (tipo = 'venta'::public.caja_mov_tipo)))
);




--
-- TOC entry 5398 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN caja_movimientos.monto; Type: COMMENT; Schema: pos; Owner: postgres
--

COMMENT ON COLUMN pos.caja_movimientos.monto IS 'Siempre positivo. El tipo de movimiento (venta/retiro/gasto) indica la dirección contable.';


--
-- TOC entry 242 (class 1259 OID 27188)
-- Name: caja_movimientos_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.caja_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5399 (class 0 OID 0)
-- Dependencies: 242
-- Name: caja_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.caja_movimientos_id_seq OWNED BY pos.caja_movimientos.id;


--
-- TOC entry 225 (class 1259 OID 26967)
-- Name: mesas; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.mesas (
    id integer NOT NULL,
    numero integer NOT NULL,
    capacidad integer,
    estado public.mesa_estado DEFAULT 'libre'::public.mesa_estado NOT NULL,
    ubicacion character varying(50),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT mesas_capacidad_check CHECK ((capacidad > 0)),
    CONSTRAINT mesas_numero_check CHECK ((numero > 0))
);




--
-- TOC entry 224 (class 1259 OID 26966)
-- Name: mesas_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.mesas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5400 (class 0 OID 0)
-- Dependencies: 224
-- Name: mesas_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.mesas_id_seq OWNED BY pos.mesas.id;


--
-- TOC entry 235 (class 1259 OID 27076)
-- Name: orden_detalles; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.orden_detalles (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    precio numeric(10,2) NOT NULL,
    subtotal numeric(10,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio)) STORED,
    observaciones text,
    estado_item public.orden_estado DEFAULT 'abierta'::public.orden_estado NOT NULL,
    es_incluido_menu boolean DEFAULT false NOT NULL,
    grupo_menu_id integer,
    enviado_cocina boolean DEFAULT false NOT NULL,
    fecha_envio_cocina timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    es_menu boolean DEFAULT false NOT NULL,
    entrada_incluida jsonb,
    fondo_incluido jsonb,
    CONSTRAINT chk_no_self_ref CHECK (((grupo_menu_id IS NULL) OR (grupo_menu_id <> id))),
    CONSTRAINT orden_detalles_cantidad_check CHECK ((cantidad > 0)),
    CONSTRAINT orden_detalles_precio_check CHECK ((precio >= (0)::numeric))
);




--
-- TOC entry 234 (class 1259 OID 27075)
-- Name: orden_detalles_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.orden_detalles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5401 (class 0 OID 0)
-- Dependencies: 234
-- Name: orden_detalles_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.orden_detalles_id_seq OWNED BY pos.orden_detalles.id;


--
-- TOC entry 233 (class 1259 OID 27052)
-- Name: ordenes; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.ordenes (
    id integer NOT NULL,
    mesa_id integer NOT NULL,
    mesero_id integer NOT NULL,
    estado public.orden_estado DEFAULT 'abierta'::public.orden_estado NOT NULL,
    numero_comanda character varying(20) DEFAULT public.gen_numero_comanda() NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    fecha_cierre timestamp without time zone
);




--
-- TOC entry 232 (class 1259 OID 27051)
-- Name: ordenes_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.ordenes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5402 (class 0 OID 0)
-- Dependencies: 232
-- Name: ordenes_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.ordenes_id_seq OWNED BY pos.ordenes.id;


--
-- TOC entry 221 (class 1259 OID 26930)
-- Name: roles; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.roles (
    id integer NOT NULL,
    nombre public.rol_tipo NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);




--
-- TOC entry 220 (class 1259 OID 26929)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5403 (class 0 OID 0)
-- Dependencies: 220
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.roles_id_seq OWNED BY pos.roles.id;


--
-- TOC entry 259 (class 1259 OID 27382)
-- Name: tickets_cocina; Type: TABLE; Schema: pos; Owner: postgres
--

CREATE TABLE pos.tickets_cocina (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    tipo_ticket public.ticket_tipo DEFAULT 'pedido_cocina'::public.ticket_tipo NOT NULL,
    impreso boolean DEFAULT false NOT NULL,
    fecha_impresion timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);




--
-- TOC entry 258 (class 1259 OID 27381)
-- Name: tickets_cocina_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.tickets_cocina_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5404 (class 0 OID 0)
-- Dependencies: 258
-- Name: tickets_cocina_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.tickets_cocina_id_seq OWNED BY pos.tickets_cocina.id;


--
-- TOC entry 222 (class 1259 OID 26943)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5405 (class 0 OID 0)
-- Dependencies: 222
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.usuarios_id_seq OWNED BY pos.usuarios.id;


--
-- TOC entry 264 (class 1259 OID 27453)
-- Name: v_caja_dia; Type: VIEW; Schema: pos; Owner: postgres
--

CREATE VIEW pos.v_caja_dia AS
 SELECT ca.id AS caja_id,
    u.nombre AS usuario_nombre,
    ca.monto_inicial,
    ca.created_at AS fecha_apertura,
    ca.estado,
    COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'venta'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric) AS total_ventas,
    COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'retiro'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric) AS total_retiros,
    COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'gasto'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric) AS total_gastos,
    (((ca.monto_inicial + COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'venta'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'retiro'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE(sum(
        CASE
            WHEN ((cm.tipo = 'gasto'::public.caja_mov_tipo) AND cm.activo) THEN cm.monto
            ELSE (0)::numeric
        END), (0)::numeric)) AS saldo_esperado
   FROM ((pos.caja_aperturas ca
     JOIN pos.usuarios u ON ((u.id = ca.usuario_id)))
     LEFT JOIN pos.caja_movimientos cm ON ((cm.caja_id = ca.id)))
  WHERE ((ca.created_at)::date = CURRENT_DATE)
  GROUP BY ca.id, u.nombre, ca.monto_inicial, ca.created_at, ca.estado;




--
-- TOC entry 266 (class 1259 OID 27463)
-- Name: v_ordenes_pendientes; Type: VIEW; Schema: pos; Owner: postgres
--

CREATE VIEW pos.v_ordenes_pendientes AS
 SELECT o.id AS orden_id,
    o.numero_comanda,
    o.estado AS estado_orden,
    m.numero AS mesa_numero,
    m.ubicacion AS mesa_ubicacion,
    u.nombre AS mesero,
    count(od.id) AS total_items,
    sum(od.cantidad) AS total_unidades,
    sum(
        CASE
            WHEN (od.es_incluido_menu = false) THEN od.subtotal
            ELSE (0)::numeric
        END) AS total_cobrable,
    sum(
        CASE
            WHEN ((od.enviado_cocina = false) AND (od.activo = true)) THEN 1
            ELSE 0
        END) AS items_pendientes_envio,
    o.created_at AS hora_apertura,
    (EXTRACT(epoch FROM (now() - (o.created_at)::timestamp with time zone)) / (60)::numeric) AS minutos_abierta
   FROM (((pos.ordenes o
     JOIN pos.mesas m ON ((m.id = o.mesa_id)))
     JOIN pos.usuarios u ON ((u.id = o.mesero_id)))
     LEFT JOIN pos.orden_detalles od ON (((od.orden_id = o.id) AND (od.activo = true))))
  WHERE ((o.estado <> ALL (ARRAY['cobrada'::public.orden_estado, 'cancelada'::public.orden_estado])) AND (o.activo = true))
  GROUP BY o.id, o.numero_comanda, o.estado, m.numero, m.ubicacion, u.nombre, o.created_at
  ORDER BY o.created_at;




--
-- TOC entry 261 (class 1259 OID 27438)
-- Name: v_ventas_hoy; Type: VIEW; Schema: pos; Owner: postgres
--

CREATE VIEW pos.v_ventas_hoy AS
 SELECT v.id,
    v.numero_ticket,
    v.created_at AS fecha,
    m.numero AS mesa_numero,
    u.nombre AS cajero_nombre,
    v.total,
    v.metodo_pago,
    v.monto_pagado,
    v.vuelto
   FROM (((pos.ventas v
     JOIN pos.ordenes o ON ((o.id = v.orden_id)))
     JOIN pos.mesas m ON ((m.id = o.mesa_id)))
     JOIN pos.usuarios u ON ((u.id = v.cajero_id)))
  WHERE (((v.created_at)::date = CURRENT_DATE) AND (v.activo = true))
  ORDER BY v.created_at DESC;




--
-- TOC entry 238 (class 1259 OID 27146)
-- Name: ventas_detalle_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.ventas_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5406 (class 0 OID 0)
-- Dependencies: 238
-- Name: ventas_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.ventas_detalle_id_seq OWNED BY pos.ventas_detalle.id;


--
-- TOC entry 236 (class 1259 OID 27112)
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: pos; Owner: postgres
--

CREATE SEQUENCE pos.ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 5407 (class 0 OID 0)
-- Dependencies: 236
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: pos; Owner: postgres
--

ALTER SEQUENCE pos.ventas_id_seq OWNED BY pos.ventas.id;


--
-- TOC entry 217 (class 1259 OID 26923)
-- Name: seq_comanda; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seq_comanda
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 219 (class 1259 OID 26925)
-- Name: seq_compra; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seq_compra
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 218 (class 1259 OID 26924)
-- Name: seq_ticket; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seq_ticket
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




--
-- TOC entry 4935 (class 2604 OID 27028)
-- Name: alertas_stock id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.alertas_stock ALTER COLUMN id SET DEFAULT nextval('inventario.alertas_stock_id_seq'::regclass);


--
-- TOC entry 4918 (class 2604 OID 26985)
-- Name: categorias id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.categorias ALTER COLUMN id SET DEFAULT nextval('inventario.categorias_id_seq'::regclass);


--
-- TOC entry 4990 (class 2604 OID 27265)
-- Name: compras id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras ALTER COLUMN id SET DEFAULT nextval('inventario.compras_id_seq'::regclass);


--
-- TOC entry 5001 (class 2604 OID 27294)
-- Name: compras_detalle id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras_detalle ALTER COLUMN id SET DEFAULT nextval('inventario.compras_detalle_id_seq'::regclass);


--
-- TOC entry 5013 (class 2604 OID 27361)
-- Name: kardex id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.kardex ALTER COLUMN id SET DEFAULT nextval('inventario.kardex_id_seq'::regclass);


--
-- TOC entry 4923 (class 2604 OID 26999)
-- Name: productos id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.productos ALTER COLUMN id SET DEFAULT nextval('inventario.productos_id_seq'::regclass);


--
-- TOC entry 4986 (class 2604 OID 27251)
-- Name: proveedores id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.proveedores ALTER COLUMN id SET DEFAULT nextval('inventario.proveedores_id_seq'::regclass);


--
-- TOC entry 5005 (class 2604 OID 27316)
-- Name: salidas_cocina id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina ALTER COLUMN id SET DEFAULT nextval('inventario.salidas_cocina_id_seq'::regclass);


--
-- TOC entry 5010 (class 2604 OID 27339)
-- Name: salidas_cocina_detalle id; Type: DEFAULT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle ALTER COLUMN id SET DEFAULT nextval('inventario.salidas_cocina_detalle_id_seq'::regclass);


--
-- TOC entry 4967 (class 2604 OID 27173)
-- Name: caja_aperturas id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_aperturas ALTER COLUMN id SET DEFAULT nextval('pos.caja_aperturas_id_seq'::regclass);


--
-- TOC entry 4975 (class 2604 OID 27220)
-- Name: caja_cierres id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_cierres ALTER COLUMN id SET DEFAULT nextval('pos.caja_cierres_id_seq'::regclass);


--
-- TOC entry 4972 (class 2604 OID 27192)
-- Name: caja_movimientos id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_movimientos ALTER COLUMN id SET DEFAULT nextval('pos.caja_movimientos_id_seq'::regclass);


--
-- TOC entry 4913 (class 2604 OID 26970)
-- Name: mesas id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.mesas ALTER COLUMN id SET DEFAULT nextval('pos.mesas_id_seq'::regclass);


--
-- TOC entry 4944 (class 2604 OID 27079)
-- Name: orden_detalles id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.orden_detalles ALTER COLUMN id SET DEFAULT nextval('pos.orden_detalles_id_seq'::regclass);


--
-- TOC entry 4938 (class 2604 OID 27055)
-- Name: ordenes id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ordenes ALTER COLUMN id SET DEFAULT nextval('pos.ordenes_id_seq'::regclass);


--
-- TOC entry 4905 (class 2604 OID 26933)
-- Name: roles id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.roles ALTER COLUMN id SET DEFAULT nextval('pos.roles_id_seq'::regclass);


--
-- TOC entry 5015 (class 2604 OID 27385)
-- Name: tickets_cocina id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.tickets_cocina ALTER COLUMN id SET DEFAULT nextval('pos.tickets_cocina_id_seq'::regclass);


--
-- TOC entry 4909 (class 2604 OID 26947)
-- Name: usuarios id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.usuarios ALTER COLUMN id SET DEFAULT nextval('pos.usuarios_id_seq'::regclass);


--
-- TOC entry 4953 (class 2604 OID 27116)
-- Name: ventas id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas ALTER COLUMN id SET DEFAULT nextval('pos.ventas_id_seq'::regclass);


--
-- TOC entry 4962 (class 2604 OID 27150)
-- Name: ventas_detalle id; Type: DEFAULT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas_detalle ALTER COLUMN id SET DEFAULT nextval('pos.ventas_detalle_id_seq'::regclass);


--
-- TOC entry 5344 (class 0 OID 27025)
-- Dependencies: 231
-- Data for Name: alertas_stock; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.alertas_stock (id, producto_id, tipo_alerta, stock_en_alerta, stock_minimo, referencia_tipo, referencia_id, usuario_id, atendida, atendida_por, fecha_atencion, created_at) FROM stdin;
\.


--
-- TOC entry 5340 (class 0 OID 26982)
-- Dependencies: 227
-- Data for Name: categorias; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.categorias (id, nombre, tipo, descripcion, activo, created_at, updated_at, color) FROM stdin;
1	Entradas	entrada	Entradas y aperitivos	t	2026-03-05 01:45:53.456908	2026-03-09 11:28:46.319555	#35e628
2	Platos de Fondo	fondo	Platos principales	t	2026-03-05 01:45:53.456908	2026-03-09 11:28:59.270395	#194ea4
3	Bebidas	bebida	Bebidas alcohólicas y no alcohólicas	t	2026-03-05 01:45:53.456908	2026-03-09 11:29:40.738751	#eb3b0f
5	Snacks	snack	Snacks y aperitivos rápidos	t	2026-03-05 01:45:53.456908	2026-03-09 11:30:02.90066	#f4ed2a
4	Postres	postre	Postres y dulces	t	2026-03-05 01:45:53.456908	2026-03-09 11:30:17.175207	#ec4bb1
6	Insumos	insumo	Insumos de cocina (arroz, pollo, etc.)	t	2026-03-05 01:45:53.456908	2026-03-09 11:30:30.336417	#acafb4
11	Platos a la carta	\N	Platos elaborados individuales	t	2026-03-09 11:27:57.569367	2026-03-14 23:31:44.37111	#5b2fc1
10	Caldos	\N	sopas xd	t	2026-03-09 11:27:22.043021	2026-03-14 23:31:44.37111	#f7733b
\.


--
-- TOC entry 5362 (class 0 OID 27262)
-- Dependencies: 249
-- Data for Name: compras; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.compras (id, proveedor_id, usuario_id, numero_compra, subtotal, total, activo, created_at, updated_at, observaciones, fecha_emision, tipo_comprobante, serie_comprobante, numero_comprobante, igv, metodo_pago, caja_movimiento_id) FROM stdin;
3	2	1	OC-20260326-0003	60.00	60.00	t	2026-03-26 23:23:59.445222	2026-03-26 23:23:59.445222	Ninguna 	2026-03-27	Boleta de Venta	F002	00002	0.00	efectivo	\N
4	1	1	OC-20260326-0004	40.50	40.50	t	2026-03-26 23:47:52.674271	2026-03-26 23:47:52.674271	Todo bien 	2026-03-27	Boleta de Venta	F003	00003	0.00	efectivo	\N
2	1	1	OC-20260326-0002	250.00	250.00	f	2026-03-26 18:38:01.934068	2026-03-27 00:06:58.462576	Faltaron 2 kilos 	2026-03-26	Boleta de Venta	F001	000001	0.00	efectivo	\N
5	1	1	OC-20260327-0005	36.00	36.00	t	2026-03-27 01:33:55.753464	2026-03-27 01:33:55.753464	Todo conforme 	2026-03-27	Nota de Venta	F004	00005	0.00	efectivo	56
8	1	1	OC-20260328-0008	75.00	75.00	t	2026-03-28 17:55:11.928204	2026-03-28 17:55:11.928204	Todo bien 	2026-03-28	Boleta de Venta	F0007	00007	0.00	efectivo	60
9	1	1	OC-20260328-0009	15.00	15.00	t	2026-03-28 18:08:04.870395	2026-03-28 18:08:04.870395	todo bien 	2026-03-28	Nota de Venta	F0008	00008	0.00	efectivo	61
10	1	1	OC-20260328-0010	30.00	30.00	t	2026-03-28 18:12:06.408088	2026-03-28 18:12:06.408088	todo conforme 	2026-03-28	Nota de Venta	F0009	00009	0.00	efectivo	62
11	1	1	OC-20260328-0011	10.00	10.00	t	2026-03-28 18:24:22.287686	2026-03-28 18:24:22.287686	nda 	2026-03-28	Nota de Venta	F00010	000010	0.00	efectivo	63
\.


--
-- TOC entry 5364 (class 0 OID 27291)
-- Dependencies: 251
-- Data for Name: compras_detalle; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.compras_detalle (id, compra_id, producto_id, cantidad, costo_unitario, activo, created_at) FROM stdin;
2	3	2	20.000	3.00	t	2026-03-26 23:23:59.445222
3	4	7	15.000	2.70	t	2026-03-26 23:47:52.674271
1	2	7	100.000	2.50	f	2026-03-26 18:38:01.934068
4	5	15	20.000	1.80	t	2026-03-27 01:33:55.753464
7	8	18	5.000	15.00	t	2026-03-28 17:55:11.928204
8	9	19	5.000	3.00	t	2026-03-28 18:08:04.870395
9	10	20	10.000	3.00	t	2026-03-28 18:12:06.408088
10	11	21	5.000	2.00	t	2026-03-28 18:24:22.287686
\.


--
-- TOC entry 5370 (class 0 OID 27358)
-- Dependencies: 257
-- Data for Name: kardex; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.kardex (id, producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, costo_unitario, referencia_tipo, referencia_id, referencia, usuario_id, reversion_de, created_at) FROM stdin;
2	2	compra	20.000	50.000	70.000	3.00	compra	3	Compra #3 - Gaseosa	1	\N	2026-03-26 23:23:59.445222
4	7	compra	15.000	0.000	15.000	2.70	compra	4	Compra #4 - Arroz 	1	\N	2026-03-26 23:47:52.674271
5	7	salida_cocina	1.000	15.000	14.000	\N	salida_cocina	2	Salida Cocina #2 - Arroz 	1	\N	2026-03-26 23:49:34.853859
6	15	compra	20.000	0.000	20.000	1.80	compra	5	Compra #5 - Jugo del valle 	1	\N	2026-03-27 01:33:55.753464
7	2	venta	1.000	70.000	69.000	\N	venta	24	Venta #24 - Gaseosa	1	\N	2026-03-27 01:40:35.842585
8	2	venta	1.000	69.000	68.000	\N	venta	24	Venta #24 - Gaseosa	1	\N	2026-03-27 01:40:35.842585
11	18	compra	5.000	0.000	5.000	15.00	compra	8	Compra #8 - Aceite chef	1	\N	2026-03-28 17:55:11.928204
12	19	compra	5.000	0.000	5.000	3.00	compra	9	Compra #9 - Sal	1	\N	2026-03-28 18:08:04.870395
13	20	compra	10.000	0.000	10.000	3.00	compra	10	Compra #10 - Papas	1	\N	2026-03-28 18:12:06.408088
14	21	compra	5.000	0.000	5.000	2.00	compra	11	Compra #11 - Cebolla 	1	\N	2026-03-28 18:24:22.287686
15	2	venta	1.000	68.000	67.000	\N	venta	25	Venta #25 - Inka cola	2	\N	2026-03-29 19:40:14.285577
16	14	venta	1.000	10.000	9.000	\N	venta	25	Venta #25 - Cerveza Pilsen	2	\N	2026-03-29 19:40:14.285577
17	14	venta	1.000	9.000	8.000	\N	venta	26	Venta #26 - Cerveza Pilsen	1	\N	2026-03-30 01:28:55.904315
18	2	venta	1.000	67.000	66.000	\N	venta	27	Venta #27 - Inka cola	1	\N	2026-03-30 01:29:09.6299
19	2	venta	1.000	66.000	65.000	\N	venta	29	Venta #29 - Inka cola	1	\N	2026-03-30 05:04:22.837114
20	15	venta	1.000	20.000	19.000	\N	venta	30	Venta #30 - Jugo del valle 	1	\N	2026-03-30 05:04:38.897121
21	14	venta	1.000	8.000	7.000	\N	venta	31	Venta #31 - Cerveza Pilsen	1	\N	2026-03-30 05:04:54.83735
22	7	salida_cocina	3.000	14.000	11.000	\N	salida_cocina	3	Salida Cocina #3 - Arroz 	1	\N	2026-03-30 05:06:30.51857
23	21	salida_cocina	2.000	5.000	3.000	\N	salida_cocina	3	Salida Cocina #3 - Cebolla 	1	\N	2026-03-30 05:06:30.51857
24	18	salida_cocina	1.000	10.000	9.000	\N	salida_cocina	3	Salida Cocina #3 - Aceite chef	1	\N	2026-03-30 05:06:30.51857
25	20	salida_cocina	3.000	10.000	7.000	\N	salida_cocina	3	Salida Cocina #3 - Papas	1	\N	2026-03-30 05:06:30.51857
\.


--
-- TOC entry 5342 (class 0 OID 26996)
-- Dependencies: 229
-- Data for Name: productos; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.productos (id, nombre, descripcion, categoria_id, tipo, precio_venta, costo_promedio, control_stock, stock_actual, stock_minimo, permite_stock_negativo, unidad_medida, activo, created_at, updated_at, disponible_en_menu, imagen_url) FROM stdin;
6	pollo a la plancha 	menu	2	preparado	12.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-11 22:16:11.535557	2026-03-30 01:55:37.157719	t	https://res.cloudinary.com/dh07a9mse/image/upload/v1774853734/restaurante_productos/dshh2j8qpmlgw91rpt1b.webp
9	Papa a ala huancaína	Entradas y aperitivos	1	preparado	4.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-11 22:24:45.882615	2026-03-30 01:56:58.955362	t	https://res.cloudinary.com/dh07a9mse/image/upload/v1774853803/restaurante_productos/nq3bbpvxuj6npxifhz3k.jpg
16	coca cola	gaseosa 	3	empacado	3.00	0.00	t	0.000	5.000	f	unidad	t	2026-03-27 02:37:13.612748	2026-03-27 02:37:13.612748	f	https://res.cloudinary.com/dh07a9mse/image/upload/v1774597020/restaurante_productos/pjfxz73psksi1rbazkju.webp
12	Aguadito 	el más económico 	10	preparado	4.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-14 23:15:25.578693	2026-03-28 16:42:30.154698	f	\N
17	Pollo broaster 	Pollo en harina 	11	preparado	13.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-28 16:48:34.24134	2026-03-28 16:48:34.24134	f	https://res.cloudinary.com/dh07a9mse/image/upload/v1774734494/restaurante_productos/iw56ob2tihckcaz5sirf.webp
19	Sal	Marina	6	insumo	0.00	2.50	t	10.000	3.000	f	kg	t	2026-03-28 18:06:54.399209	2026-03-28 18:08:04.870395	f	\N
1	Pollo guisado 	rico	2	fondo	10.00	0.00	f	0.000	0.000	f	gr	t	2026-03-05 19:13:54.039668	2026-03-11 22:27:11.790972	t	\N
3	Sopa	de pollo	1	entrada	5.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-05 19:43:27.702349	2026-03-11 22:27:12.550464	t	\N
4	Tallarín con pollo	tallarin verde 	2	fondo	12.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-05 20:53:29.297691	2026-03-11 22:27:14.067285	t	\N
10	Combinado	El mejor 	11	preparado	13.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-14 23:11:41.633167	2026-03-14 23:11:41.633167	f	\N
13	Chisitos 	nose 	5	preparado	1.50	0.00	f	0.000	0.000	f	unidad	t	2026-03-14 23:20:06.839562	2026-03-14 23:20:06.839562	f	\N
2	Inka cola	gaseosa 	3	empacado	3.00	0.00	t	65.000	10.000	f	unidad	t	2026-03-05 19:42:11.465762	2026-03-30 05:04:22.837114	f	https://res.cloudinary.com/dh07a9mse/image/upload/v1774596925/restaurante_productos/eznbayhoxbcqjc533kvu.png
15	Jugo del valle 	naranja 	3	empacado	2.00	0.00	t	19.000	5.000	f	unidad	t	2026-03-26 23:03:31.891263	2026-03-30 05:04:38.897121	f	https://res.cloudinary.com/dh07a9mse/image/upload/v1774597104/restaurante_productos/llxru2emfbbhggzmwvwp.webp
14	Cerveza Pilsen	pilsen callao	3	empacado	8.00	6.00	t	7.000	5.000	f	unidad	t	2026-03-26 20:18:42.773073	2026-03-30 05:04:54.83735	f	https://res.cloudinary.com/dh07a9mse/image/upload/v1774575222/restaurante_productos/mf8ndnhth6ndaxfhmgen.jpg
7	Arroz 	compras 	6	insumo	0.00	0.00	t	11.000	5.000	f	kg	t	2026-03-11 22:17:54.79534	2026-03-30 05:06:30.51857	f	https://res.cloudinary.com/dh07a9mse/image/upload/v1774575606/restaurante_productos/ugeibsywqamapizhwane.jpg
21	Cebolla 	De cabeza 	6	insumo	0.00	2.00	t	3.000	2.000	f	kg	t	2026-03-28 18:23:23.451818	2026-03-30 05:06:30.51857	f	\N
18	Aceite chef	vegetal 	6	insumo	0.00	12.50	t	9.000	0.000	f	unidad	t	2026-03-28 17:48:50.588467	2026-03-30 05:06:30.51857	f	\N
20	Papas	Huairo	6	insumo	0.00	2.75	t	7.000	2.000	f	kg	t	2026-03-28 18:11:05.025996	2026-03-30 05:06:30.51857	f	\N
8	Arroz con mariscos 	platos marinos 	11	preparado	15.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-11 22:23:02.609905	2026-03-26 19:22:29.607977	f	\N
11	Caldo de gallina	xd	10	preparado	12.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-14 23:14:43.385439	2026-03-26 19:22:30.45778	f	\N
5	Ceviche simple	pescado fresco 	11	fondo	20.00	0.00	f	0.000	0.000	f	unidad	t	2026-03-09 11:36:11.348592	2026-03-26 20:24:13.621698	f	
\.


--
-- TOC entry 5360 (class 0 OID 27248)
-- Dependencies: 247
-- Data for Name: proveedores; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.proveedores (id, nombre, ruc, telefono, direccion, email, tipo_producto, activo, created_at, updated_at) FROM stdin;
1	Distribuidora ABC	20123456785	982483815	los cedros 	ginoriscoarana8@gmail.com	Bebidas 	t	2026-03-26 12:26:57.757467	2026-03-26 12:26:57.757467
2	Arca Continental Lindley S.A	 20100109968	964835678	trujillo 	cocacola@gmail.com	Bebidas 	t	2026-03-26 23:22:35.329486	2026-03-26 23:22:35.329486
\.


--
-- TOC entry 5366 (class 0 OID 27313)
-- Dependencies: 253
-- Data for Name: salidas_cocina; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.salidas_cocina (id, usuario_id, turno, observaciones, aprobado, aprobado_por, fecha_aprobacion, activo, created_at, updated_at) FROM stdin;
1	1	manana	\N	t	1	2026-03-26 23:24:48.94988	t	2026-03-26 22:15:53.667654	2026-03-26 23:24:48.94988
2	1	manana	Usado de turno 	t	1	2026-03-26 23:49:34.853859	t	2026-03-26 23:49:29.072097	2026-03-26 23:49:34.853859
3	1	noche	fin de turno 	t	1	2026-03-30 05:06:30.51857	t	2026-03-30 05:06:25.518575	2026-03-30 05:06:30.51857
\.


--
-- TOC entry 5368 (class 0 OID 27336)
-- Dependencies: 255
-- Data for Name: salidas_cocina_detalle; Type: TABLE DATA; Schema: inventario; Owner: postgres
--

COPY inventario.salidas_cocina_detalle (id, salida_id, producto_id, cantidad, observaciones, activo, created_at) FROM stdin;
1	1	7	1.000	\N	t	2026-03-26 22:15:53.667654
2	2	7	1.000	\N	t	2026-03-26 23:49:29.072097
3	3	7	3.000	\N	t	2026-03-30 05:06:25.518575
4	3	21	2.000	\N	t	2026-03-30 05:06:25.518575
5	3	18	1.000	\N	t	2026-03-30 05:06:25.518575
6	3	20	3.000	\N	t	2026-03-30 05:06:25.518575
\.


--
-- TOC entry 5354 (class 0 OID 27170)
-- Dependencies: 241
-- Data for Name: caja_aperturas; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.caja_aperturas (id, usuario_id, monto_inicial, estado, observaciones, activo, created_at, updated_at) FROM stdin;
1	1	100.00	cerrada	turno de menu	t	2026-03-16 20:20:44.064062	2026-03-16 21:58:57.758944
2	1	50.00	cerrada	tarde	t	2026-03-16 21:59:14.397959	2026-03-17 19:12:57.030008
3	1	100.00	cerrada	turno mañana 	t	2026-03-17 19:15:12.193249	2026-03-17 19:37:09.970457
4	1	100.00	cerrada	turno de menu	t	2026-03-17 19:37:42.753726	2026-03-17 20:43:02.152554
5	1	100.00	cerrada	turno pe	t	2026-03-17 20:50:17.941281	2026-03-17 20:50:58.829654
6	1	100.00	cerrada	turno 1	t	2026-03-17 22:33:53.582414	2026-03-17 22:34:55.739686
7	1	50.00	cerrada	nose	t	2026-03-17 22:39:20.641733	2026-03-17 22:40:56.420869
8	1	100.00	cerrada	\N	t	2026-03-17 22:46:43.586487	2026-03-17 22:47:37.216421
9	1	200.00	cerrada	\N	t	2026-03-17 22:48:43.687613	2026-03-17 23:06:11.341338
10	1	100.00	cerrada	\N	t	2026-03-17 23:12:29.827537	2026-03-17 23:13:20.901998
11	1	200.00	cerrada	madrugada 	t	2026-03-27 01:32:32.100506	2026-03-30 05:17:58.019387
\.


--
-- TOC entry 5358 (class 0 OID 27217)
-- Dependencies: 245
-- Data for Name: caja_cierres; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.caja_cierres (id, caja_id, usuario_id, total_ventas, total_efectivo, total_tarjeta, total_otro, total_retiros, total_gastos, monto_inicial, monto_final_real, observaciones, created_at) FROM stdin;
1	1	1	0.00	0.00	0.00	0.00	0.00	0.00	100.00	100.00	\N	2026-03-16 21:58:57.758944
2	2	1	265.00	173.00	0.00	92.00	0.00	0.00	50.00	223.00	\N	2026-03-17 19:12:57.030008
3	3	1	0.00	0.00	0.00	0.00	160.00	90.00	100.00	10.00	\N	2026-03-17 19:37:09.970457
4	4	1	0.00	0.00	0.00	0.00	0.00	50.00	100.00	100.00	nada	2026-03-17 20:43:02.152554
5	5	1	0.00	0.00	0.00	0.00	0.00	5.00	100.00	115.00	\N	2026-03-17 20:50:58.829654
6	6	1	0.00	0.00	0.00	0.00	0.00	10.00	100.00	140.00	todo ok 	2026-03-17 22:34:55.739686
7	7	1	0.00	0.00	0.00	0.00	0.00	5.00	50.00	45.00	no falta nada 	2026-03-17 22:40:56.420869
8	8	1	0.00	0.00	0.00	0.00	0.00	12.00	100.00	80.00	se perdio 10 	2026-03-17 22:47:37.216421
9	9	1	0.00	0.00	0.00	0.00	0.00	20.00	200.00	300.00	30 soles falsos 	2026-03-17 23:06:11.341338
10	10	1	0.00	0.00	0.00	0.00	3.00	0.00	100.00	136.00	falto un sol, se perdio 	2026-03-17 23:13:20.901998
11	11	1	266.00	155.00	0.00	111.00	166.00	0.00	200.00	180.00	nueve soles falsos 	2026-03-30 05:17:58.019387
\.


--
-- TOC entry 5356 (class 0 OID 27189)
-- Dependencies: 243
-- Data for Name: caja_movimientos; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.caja_movimientos (id, caja_id, tipo, descripcion, monto, venta_id, usuario_id, activo, created_at, referencia_tipo, referencia_id) FROM stdin;
1	1	apertura	Apertura de caja	100.00	\N	1	t	2026-03-16 20:20:44.064062	\N	\N
2	1	cierre	Cierre de caja	100.00	\N	1	t	2026-03-16 21:58:57.758944	\N	\N
3	2	apertura	Apertura de caja	50.00	\N	1	t	2026-03-16 21:59:14.397959	\N	\N
4	2	venta	Venta #14	37.00	14	1	t	2026-03-16 22:38:17.585405	\N	\N
5	2	venta	Venta #15	30.00	15	1	t	2026-03-16 22:43:52.621924	\N	\N
6	2	venta	Venta #16	30.00	16	1	t	2026-03-16 22:44:18.681556	\N	\N
7	2	venta	Venta #17	25.00	17	1	t	2026-03-16 22:44:37.554278	\N	\N
8	2	venta	Venta #18	26.00	18	1	t	2026-03-16 22:44:57.510359	\N	\N
9	2	venta	Venta #19	3.00	19	1	t	2026-03-16 22:45:06.805032	\N	\N
10	2	venta	Venta #20	24.00	20	1	t	2026-03-16 22:48:41.254434	\N	\N
11	2	venta	Venta #21	28.00	21	1	t	2026-03-16 23:40:20.131312	\N	\N
12	2	venta	Venta #22	27.00	22	1	t	2026-03-17 19:08:51.074908	\N	\N
13	2	venta	Venta #23	35.00	23	1	t	2026-03-17 19:11:55.590398	\N	\N
14	2	cierre	Cierre de caja	223.00	\N	1	t	2026-03-17 19:12:57.030008	\N	\N
15	3	apertura	Apertura de caja	100.00	\N	1	t	2026-03-17 19:15:12.193249	\N	\N
16	3	gasto	compra de gas	50.00	\N	1	t	2026-03-17 19:19:48.413435	\N	\N
17	3	retiro	jefe dejo para dar vuelto 	100.00	\N	1	t	2026-03-17 19:20:22.697056	\N	\N
18	3	retiro	dejaron 	50.00	\N	1	t	2026-03-17 19:20:55.364669	\N	\N
19	3	gasto	devuelve adelanto 	10.00	\N	1	t	2026-03-17 19:25:20.390682	\N	\N
20	3	retiro	compra de bolsas 	10.00	\N	1	t	2026-03-17 19:28:42.087038	\N	\N
21	3	gasto	compra de platos	30.00	\N	1	t	2026-03-17 19:31:02.629536	\N	\N
24	3	cierre	Cierre de caja	10.00	\N	1	t	2026-03-17 19:37:09.970457	\N	\N
25	4	apertura	Apertura de caja	100.00	\N	1	t	2026-03-17 19:37:42.753726	\N	\N
27	4	gasto	\N	50.00	\N	1	t	2026-03-17 19:54:06.91791	\N	\N
28	4	ingreso	\N	50.00	\N	1	t	2026-03-17 20:26:31.065345	\N	\N
29	4	cierre	Cierre de caja	100.00	\N	1	t	2026-03-17 20:43:02.152554	\N	\N
30	5	apertura	Apertura de caja	100.00	\N	1	t	2026-03-17 20:50:17.941281	\N	\N
31	5	ingreso	\N	20.00	\N	1	t	2026-03-17 20:50:28.71959	\N	\N
32	5	gasto	\N	5.00	\N	1	t	2026-03-17 20:50:45.951029	\N	\N
33	5	cierre	Cierre de caja	115.00	\N	1	t	2026-03-17 20:50:58.829654	\N	\N
34	6	apertura	Apertura de caja	100.00	\N	1	t	2026-03-17 22:33:53.582414	\N	\N
35	6	ingreso	\N	50.00	\N	1	t	2026-03-17 22:34:08.086005	\N	\N
36	6	gasto	\N	10.00	\N	1	t	2026-03-17 22:34:30.336526	\N	\N
37	6	cierre	Cierre de caja	140.00	\N	1	t	2026-03-17 22:34:55.739686	\N	\N
38	7	apertura	Apertura de caja	50.00	\N	1	t	2026-03-17 22:39:20.641733	\N	\N
39	7	ingreso	\N	40.00	\N	1	t	2026-03-17 22:39:35.922821	\N	\N
40	7	gasto	\N	5.00	\N	1	t	2026-03-17 22:39:50.834643	\N	\N
41	7	cierre	Cierre de caja	45.00	\N	1	t	2026-03-17 22:40:56.420869	\N	\N
42	8	apertura	Apertura de caja	100.00	\N	1	t	2026-03-17 22:46:43.586487	\N	\N
43	8	ingreso	\N	50.00	\N	1	t	2026-03-17 22:47:01.17808	\N	\N
44	8	gasto	\N	12.00	\N	1	t	2026-03-17 22:47:20.763829	\N	\N
45	8	cierre	Cierre de caja	80.00	\N	1	t	2026-03-17 22:47:37.216421	\N	\N
46	9	apertura	Apertura de caja	200.00	\N	1	t	2026-03-17 22:48:43.687613	\N	\N
47	9	ingreso	\N	50.00	\N	1	t	2026-03-17 22:48:53.488669	\N	\N
48	9	ingreso	\N	100.00	\N	1	t	2026-03-17 22:57:31.719266	\N	\N
49	9	gasto	\N	20.00	\N	1	t	2026-03-17 22:57:54.354291	\N	\N
50	9	cierre	Cierre de caja	300.00	\N	1	t	2026-03-17 23:06:11.341338	\N	\N
51	10	apertura	Apertura de caja	100.00	\N	1	t	2026-03-17 23:12:29.827537	\N	\N
52	10	ingreso	\N	40.00	\N	1	t	2026-03-17 23:12:40.132183	\N	\N
53	10	gasto	\N	3.00	\N	1	t	2026-03-17 23:12:50.466574	\N	\N
54	10	cierre	Cierre de caja	136.00	\N	1	t	2026-03-17 23:13:20.901998	\N	\N
55	11	apertura	Apertura de caja	200.00	\N	1	t	2026-03-27 01:32:32.100506	\N	\N
56	11	gasto	Pago Compra #5 - Distribuidora ABC	36.00	\N	1	t	2026-03-27 01:33:55.753464	compra	5
57	11	venta	Venta #24	33.00	24	1	t	2026-03-27 01:40:35.842585	\N	\N
60	11	gasto	Pago Compra #8 - Distribuidora ABC	75.00	\N	1	t	2026-03-28 17:55:11.928204	compra	8
61	11	gasto	Pago Compra #9 - Distribuidora ABC	15.00	\N	1	t	2026-03-28 18:08:04.870395	compra	9
62	11	gasto	Pago Compra #10 - Distribuidora ABC	30.00	\N	1	t	2026-03-28 18:12:06.408088	compra	10
63	11	gasto	Pago Compra #11 - Distribuidora ABC	10.00	\N	1	t	2026-03-28 18:24:22.287686	compra	11
64	11	venta	Venta #25	31.00	25	2	t	2026-03-29 19:40:14.285577	\N	\N
65	11	venta	Venta #26	20.00	26	1	t	2026-03-30 01:28:55.904315	\N	\N
66	11	venta	Venta #27	15.00	27	1	t	2026-03-30 01:29:09.6299	\N	\N
67	11	venta	Venta #28	44.00	28	1	t	2026-03-30 05:04:04.399845	\N	\N
68	11	venta	Venta #29	47.00	29	1	t	2026-03-30 05:04:22.837114	\N	\N
69	11	venta	Venta #30	36.00	30	1	t	2026-03-30 05:04:38.897121	\N	\N
70	11	venta	Venta #31	40.00	31	1	t	2026-03-30 05:04:54.83735	\N	\N
71	11	cierre	Cierre de caja	180.00	\N	1	t	2026-03-30 05:17:58.019387	\N	\N
\.


--
-- TOC entry 5338 (class 0 OID 26967)
-- Dependencies: 225
-- Data for Name: mesas; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.mesas (id, numero, capacidad, estado, ubicacion, activo, created_at, updated_at) FROM stdin;
4	4	5	libre	Salon calle	t	2026-03-05 16:45:22.333186	2026-03-30 05:04:04.399845
3	3	4	libre	Salon principal 	t	2026-03-05 16:29:54.270308	2026-03-30 05:04:54.83735
1	1	4	ocupada	Salon principal 	t	2026-03-05 16:25:56.570018	2026-03-30 05:31:46.859347
2	2	5	ocupada	Salon principal 	t	2026-03-05 16:26:36.577309	2026-03-30 05:34:40.219217
6	6	4	libre	Salon principal 	t	2026-03-15 00:24:30.149998	2026-03-16 22:38:17.585405
5	5	4	libre	Salon principal 	t	2026-03-05 16:45:46.446375	2026-03-16 22:44:18.681556
\.


--
-- TOC entry 5348 (class 0 OID 27076)
-- Dependencies: 235
-- Data for Name: orden_detalles; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.orden_detalles (id, orden_id, producto_id, cantidad, precio, observaciones, estado_item, es_incluido_menu, grupo_menu_id, enviado_cocina, fecha_envio_cocina, activo, created_at, updated_at, es_menu, entrada_incluida, fondo_incluido) FROM stdin;
4	2	2	1	3.00	\N	abierta	f	\N	t	2026-03-05 21:18:27.991795	t	2026-03-05 21:15:34.854792	2026-03-05 21:18:27.991795	f	\N	\N
5	3	2	1	3.00	\N	abierta	f	\N	t	2026-03-14 23:34:46.53758	t	2026-03-05 21:24:20.400322	2026-03-14 23:34:46.53758	f	\N	\N
6	3	1	1	10.00	\N	abierta	f	\N	t	2026-03-14 23:34:46.53758	t	2026-03-14 23:34:33.300346	2026-03-14 23:34:46.53758	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 1, "nombre": "Pollo guisado "}
7	3	10	1	13.00	\N	abierta	f	\N	t	2026-03-14 23:34:46.53758	t	2026-03-14 23:34:33.300346	2026-03-14 23:34:46.53758	f	\N	\N
1	1	1	1	10.00	\N	abierta	f	\N	f	\N	f	2026-03-05 20:13:26.421469	2026-03-14 23:37:24.699783	f	\N	\N
2	1	3	1	5.00	\N	abierta	f	\N	f	\N	f	2026-03-05 20:13:26.421469	2026-03-14 23:37:29.122536	f	\N	\N
3	1	2	1	3.00	\N	abierta	f	\N	f	\N	f	2026-03-05 20:13:32.483672	2026-03-14 23:37:32.893201	f	\N	\N
8	1	8	1	15.00	\N	abierta	f	\N	t	2026-03-14 23:53:04.565241	t	2026-03-14 23:52:59.799978	2026-03-14 23:53:04.565241	f	\N	\N
9	1	6	1	12.00	\N	abierta	f	\N	t	2026-03-14 23:53:34.929718	t	2026-03-14 23:53:32.067361	2026-03-14 23:53:34.929718	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
10	4	6	1	12.00	\N	abierta	f	\N	t	2026-03-15 00:04:35.306936	t	2026-03-15 00:04:29.678982	2026-03-15 00:04:35.306936	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
11	4	10	1	13.00	\N	abierta	f	\N	t	2026-03-15 00:05:03.791633	t	2026-03-15 00:04:57.833759	2026-03-15 00:05:03.791633	f	\N	\N
12	1	1	1	10.00	\N	abierta	f	\N	f	\N	f	2026-03-15 00:05:37.455882	2026-03-15 00:05:55.278146	t	{"id": 3, "nombre": "Sopa"}	{"id": 1, "nombre": "Pollo guisado "}
13	5	6	1	12.00	\N	abierta	f	\N	t	2026-03-16 20:41:02.706621	t	2026-03-16 20:40:58.733512	2026-03-16 20:41:02.706621	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
14	5	2	1	3.00	\N	abierta	f	\N	t	2026-03-16 20:41:02.706621	t	2026-03-16 20:40:58.733512	2026-03-16 20:41:02.706621	f	\N	\N
15	5	8	1	15.00	\N	abierta	f	\N	t	2026-03-16 20:44:13.208842	t	2026-03-16 20:44:10.289939	2026-03-16 20:44:13.208842	f	\N	\N
16	1	2	1	3.00	\N	abierta	f	\N	t	2026-03-16 20:46:57.105077	t	2026-03-16 20:46:54.026469	2026-03-16 20:46:57.105077	f	\N	\N
17	6	8	1	15.00	\N	abierta	f	\N	t	2026-03-16 21:29:33.32478	t	2026-03-16 21:29:26.595143	2026-03-16 21:29:33.32478	f	\N	\N
18	6	11	1	12.00	\N	abierta	f	\N	t	2026-03-16 21:29:33.32478	t	2026-03-16 21:29:26.595143	2026-03-16 21:29:33.32478	f	\N	\N
19	6	1	1	10.00	\N	abierta	f	\N	t	2026-03-16 21:29:33.32478	t	2026-03-16 21:29:26.595143	2026-03-16 21:29:33.32478	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 1, "nombre": "Pollo guisado "}
20	7	6	1	12.00	\N	abierta	f	\N	t	2026-03-16 22:47:52.447479	t	2026-03-16 22:47:45.648129	2026-03-16 22:47:52.447479	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
21	7	11	1	12.00	\N	abierta	f	\N	t	2026-03-16 22:47:52.447479	t	2026-03-16 22:47:45.648129	2026-03-16 22:47:52.447479	f	\N	\N
22	8	6	1	12.00	\N	abierta	f	\N	t	2026-03-16 23:37:54.56209	t	2026-03-16 23:37:49.339116	2026-03-16 23:37:54.56209	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
23	8	2	1	3.00	\N	abierta	f	\N	t	2026-03-16 23:37:54.56209	t	2026-03-16 23:37:49.339116	2026-03-16 23:37:54.56209	f	\N	\N
24	8	10	1	13.00	\N	abierta	f	\N	t	2026-03-16 23:37:54.56209	t	2026-03-16 23:37:49.339116	2026-03-16 23:37:54.56209	f	\N	\N
25	9	6	1	12.00	\N	abierta	f	\N	t	2026-03-17 19:07:54.981787	t	2026-03-17 19:07:47.266475	2026-03-17 19:07:54.981787	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
26	9	8	1	15.00	\N	abierta	f	\N	t	2026-03-17 19:07:54.981787	t	2026-03-17 19:07:47.266475	2026-03-17 19:07:54.981787	f	\N	\N
27	10	8	1	15.00	\N	abierta	f	\N	t	2026-03-17 19:11:38.46747	t	2026-03-17 19:11:34.921144	2026-03-17 19:11:38.46747	f	\N	\N
28	10	5	1	20.00	\N	abierta	f	\N	t	2026-03-17 19:11:38.46747	t	2026-03-17 19:11:34.921144	2026-03-17 19:11:38.46747	f	\N	\N
29	11	6	1	12.00	\N	abierta	f	\N	t	2026-03-27 01:38:45.886353	t	2026-03-27 01:38:32.902142	2026-03-27 01:38:45.886353	t	{"id": 3, "nombre": "Sopa"}	{"id": 6, "nombre": "pollo a la plancha "}
30	11	2	1	3.00	\N	abierta	f	\N	t	2026-03-27 01:38:45.886353	t	2026-03-27 01:38:32.902142	2026-03-27 01:38:45.886353	f	\N	\N
31	11	8	1	15.00	\N	abierta	f	\N	t	2026-03-27 01:38:45.886353	t	2026-03-27 01:38:32.902142	2026-03-27 01:38:45.886353	f	\N	\N
32	11	2	1	3.00	\N	abierta	f	\N	t	2026-03-27 01:39:47.981906	t	2026-03-27 01:39:45.18342	2026-03-27 01:39:47.981906	f	\N	\N
33	12	5	1	20.00	\N	abierta	f	\N	t	2026-03-27 02:02:10.474809	t	2026-03-27 02:01:59.782646	2026-03-27 02:02:10.474809	f	\N	\N
34	12	14	1	8.00	\N	abierta	f	\N	t	2026-03-27 02:02:10.474809	t	2026-03-27 02:01:59.782646	2026-03-27 02:02:10.474809	f	\N	\N
35	12	10	1	13.00	\N	abierta	f	\N	f	\N	f	2026-03-27 02:09:15.969853	2026-03-27 02:09:21.801471	f	\N	\N
36	12	2	1	3.00	\N	abierta	f	\N	t	2026-03-27 02:13:01.162898	t	2026-03-27 02:12:56.664434	2026-03-27 02:13:01.162898	f	\N	\N
37	13	6	1	12.00	\N	abierta	f	\N	t	2026-03-29 19:36:04.400095	t	2026-03-29 19:35:59.972354	2026-03-29 19:36:04.400095	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
38	13	14	1	8.00	\N	abierta	f	\N	t	2026-03-29 19:36:04.400095	t	2026-03-29 19:35:59.972354	2026-03-29 19:36:04.400095	f	\N	\N
39	14	6	1	12.00	\N	abierta	f	\N	t	2026-03-29 21:17:28.661176	t	2026-03-29 21:17:18.094766	2026-03-29 21:17:28.661176	t	{"id": 9, "nombre": "Papa a ala huancaína"}	{"id": 6, "nombre": "pollo a la plancha "}
40	14	2	1	3.00	\N	abierta	f	\N	t	2026-03-29 21:17:28.661176	t	2026-03-29 21:17:18.094766	2026-03-29 21:17:28.661176	f	\N	\N
41	15	1	1	10.00	\N	abierta	f	\N	f	\N	f	2026-03-29 21:23:09.462968	2026-03-30 00:11:10.351944	t	{"id": 3, "nombre": "Sopa"}	{"id": 1, "nombre": "Pollo guisado "}
42	15	14	1	8.00	\N	abierta	f	\N	f	\N	f	2026-03-29 21:23:09.462968	2026-03-30 00:43:02.84736	f	\N	\N
44	15	14	1	8.00	\N	abierta	f	\N	f	\N	f	2026-03-30 00:26:25.483965	2026-03-30 00:45:37.417558	f	\N	\N
43	15	8	1	15.00	\N	abierta	f	\N	f	\N	f	2026-03-30 00:26:25.483965	2026-03-30 01:07:19.045002	f	\N	\N
45	15	12	1	4.00	\N	abierta	f	\N	t	2026-03-30 01:07:25.077283	t	2026-03-30 00:45:32.823227	2026-03-30 01:07:25.077283	f	\N	\N
46	15	14	1	8.00	\N	abierta	f	\N	t	2026-03-30 01:07:25.077283	t	2026-03-30 01:07:12.74103	2026-03-30 01:07:25.077283	f	\N	\N
47	15	11	1	12.00	\N	abierta	f	\N	t	2026-03-30 01:07:25.077283	t	2026-03-30 01:07:12.74103	2026-03-30 01:07:25.077283	f	\N	\N
48	15	13	1	1.50	\N	abierta	f	\N	f	\N	f	2026-03-30 01:28:10.375196	2026-03-30 01:28:14.999109	f	\N	\N
49	15	12	1	4.00	\N	abierta	f	\N	t	2026-03-30 02:15:56.727922	t	2026-03-30 02:14:01.100852	2026-03-30 02:15:56.727922	f	\N	\N
51	15	14	4	8.00	\N	abierta	f	\N	f	\N	f	2026-03-30 02:16:42.227486	2026-03-30 02:17:01.559113	f	\N	\N
50	15	8	1	15.00	\N	abierta	f	\N	f	\N	f	2026-03-30 02:16:42.227486	2026-03-30 02:17:06.186709	f	\N	\N
52	16	11	1	12.00	\N	abierta	f	\N	t	2026-03-30 02:20:39.95759	t	2026-03-30 02:20:26.615945	2026-03-30 02:20:39.95759	f	\N	\N
53	16	15	1	2.00	\N	abierta	f	\N	t	2026-03-30 02:20:39.95759	t	2026-03-30 02:20:26.615945	2026-03-30 02:20:39.95759	f	\N	\N
54	17	12	1	4.00	\N	abierta	f	\N	t	2026-03-30 02:38:13.940421	t	2026-03-30 02:38:10.910432	2026-03-30 02:38:13.940421	f	\N	\N
55	17	2	1	3.00	\N	abierta	f	\N	t	2026-03-30 02:38:13.940421	t	2026-03-30 02:38:10.910432	2026-03-30 02:38:13.940421	f	\N	\N
56	18	8	1	15.00	\N	abierta	f	\N	t	2026-03-30 03:39:51.697652	t	2026-03-30 03:27:01.989336	2026-03-30 03:39:51.697652	f	\N	\N
57	18	6	1	12.00	\N	abierta	f	\N	t	2026-03-30 03:40:22.705221	t	2026-03-30 03:40:14.641319	2026-03-30 03:40:22.705221	t	{"id": 3, "nombre": "Sopa"}	{"id": 6, "nombre": "pollo a la plancha "}
58	17	5	1	20.00	\N	abierta	f	\N	t	2026-03-30 04:24:22.631037	t	2026-03-30 03:58:09.506434	2026-03-30 04:24:22.631037	f	\N	\N
60	17	4	1	12.00	\N	abierta	f	\N	f	\N	f	2026-03-30 04:24:52.619394	2026-03-30 04:25:01.43306	t	{"id": 3, "nombre": "Sopa"}	{"id": 4, "nombre": "Tallarín con pollo"}
61	17	5	1	20.00	\N	abierta	f	\N	t	2026-03-30 04:31:57.538265	t	2026-03-30 04:31:47.462004	2026-03-30 04:31:57.538265	f	\N	\N
62	16	1	1	10.00	\N	abierta	f	\N	t	2026-03-30 04:33:35.726866	t	2026-03-30 04:33:14.209215	2026-03-30 04:33:35.726866	t	{"id": 3, "nombre": "Sopa"}	{"id": 1, "nombre": "Pollo guisado "}
59	18	12	1	4.00	\N	abierta	f	\N	t	2026-03-30 04:34:13.511139	t	2026-03-30 03:58:48.425451	2026-03-30 04:34:13.511139	f	\N	\N
63	16	4	1	12.00	\N	abierta	f	\N	t	2026-03-30 04:46:01.861968	t	2026-03-30 04:45:32.615408	2026-03-30 04:46:01.861968	t	{"id": 3, "nombre": "Sopa"}	{"id": 4, "nombre": "Tallarín con pollo"}
64	15	11	1	12.00	\N	abierta	f	\N	t	2026-03-30 04:50:21.458942	t	2026-03-30 04:49:45.368655	2026-03-30 04:50:21.458942	f	\N	\N
65	18	10	1	13.00	Con pata	abierta	f	\N	t	2026-03-30 04:53:52.518176	t	2026-03-30 04:53:43.305963	2026-03-30 04:53:52.518176	f	\N	\N
66	19	5	1	20.00	Sin aji	abierta	f	\N	t	2026-03-30 05:32:17.010545	t	2026-03-30 05:31:56.31943	2026-03-30 05:32:17.010545	f	\N	\N
67	20	11	1	12.00	Parte pecho	abierta	f	\N	t	2026-03-30 05:34:59.387388	t	2026-03-30 05:34:49.747557	2026-03-30 05:34:59.387388	f	\N	\N
\.


--
-- TOC entry 5346 (class 0 OID 27052)
-- Dependencies: 233
-- Data for Name: ordenes; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.ordenes (id, mesa_id, mesero_id, estado, numero_comanda, observaciones, activo, created_at, updated_at, fecha_cierre) FROM stdin;
6	6	1	cobrada	C-20260316-0006	Orden desde Mesa 6	t	2026-03-16 21:28:46.75095	2026-03-16 22:38:17.585405	2026-03-16 22:38:17.585405
1	1	1	cobrada	C-20260305-0001	Orden desde Mesa 1	t	2026-03-05 18:51:49.72644	2026-03-16 22:43:52.621924	2026-03-16 22:43:52.621924
5	5	1	cobrada	C-20260316-0005	Orden desde Mesa 5	t	2026-03-16 20:40:41.436925	2026-03-16 22:44:18.681556	2026-03-16 22:44:18.681556
4	4	1	cobrada	C-20260314-0004	Orden desde Mesa 4	t	2026-03-14 22:37:34.797056	2026-03-16 22:44:37.554278	2026-03-16 22:44:37.554278
3	3	1	cobrada	C-20260305-0003	Orden desde Mesa 3	t	2026-03-05 20:43:36.349165	2026-03-16 22:44:57.510359	2026-03-16 22:44:57.510359
2	2	1	cobrada	C-20260305-0002	Orden desde Mesa 2	t	2026-03-05 18:53:07.207548	2026-03-16 22:45:06.805032	2026-03-16 22:45:06.805032
7	1	1	cobrada	C-20260316-0007	Orden desde Mesa 1	t	2026-03-16 22:47:30.108386	2026-03-16 22:48:41.254434	2026-03-16 22:48:41.254434
8	1	1	cobrada	C-20260316-0008	Orden desde Mesa 1	t	2026-03-16 23:35:50.203082	2026-03-16 23:40:20.131312	2026-03-16 23:40:20.131312
9	2	1	cobrada	C-20260317-0009	Orden desde Mesa 2	t	2026-03-17 19:04:38.905874	2026-03-17 19:08:51.074908	2026-03-17 19:08:51.074908
10	1	1	cobrada	C-20260317-0010	Orden desde Mesa 1	t	2026-03-17 19:11:25.032264	2026-03-17 19:11:55.590398	2026-03-17 19:11:55.590398
11	1	1	cobrada	C-20260327-0011	Orden desde Mesa 1	t	2026-03-27 01:38:09.482981	2026-03-27 01:40:35.842585	2026-03-27 01:40:35.842585
12	2	1	cobrada	C-20260327-0012	Orden desde Mesa 2	t	2026-03-27 01:47:22.489884	2026-03-29 19:40:14.285577	2026-03-29 19:40:14.285577
13	1	3	cobrada	C-20260329-0013	Orden desde Mesa 1	t	2026-03-29 19:35:40.550821	2026-03-30 01:28:55.904315	2026-03-30 01:28:55.904315
14	2	3	cobrada	C-20260329-0014	Orden desde Mesa 2	t	2026-03-29 21:16:14.526909	2026-03-30 01:29:09.6299	2026-03-30 01:29:09.6299
18	4	4	cobrada	C-20260330-0018	Orden desde Mesa 4	t	2026-03-30 03:04:27.074224	2026-03-30 05:04:04.399845	2026-03-30 05:04:04.399845
17	2	3	cobrada	C-20260330-0017	Orden desde Mesa 2	t	2026-03-30 02:37:59.991764	2026-03-30 05:04:22.837114	2026-03-30 05:04:22.837114
16	1	3	cobrada	C-20260330-0016	Orden desde Mesa 1	t	2026-03-30 02:19:51.373725	2026-03-30 05:04:38.897121	2026-03-30 05:04:38.897121
15	3	3	cobrada	C-20260329-0015	Orden desde Mesa 3	t	2026-03-29 21:22:43.252338	2026-03-30 05:04:54.83735	2026-03-30 05:04:54.83735
19	1	4	abierta	C-20260330-0019	Orden desde Mesa 1	t	2026-03-30 05:31:46.842865	2026-03-30 05:31:46.842865	\N
20	2	4	abierta	C-20260330-0020	Orden desde Mesa 2	t	2026-03-30 05:34:40.212293	2026-03-30 05:34:40.212293	\N
\.


--
-- TOC entry 5334 (class 0 OID 26930)
-- Dependencies: 221
-- Data for Name: roles; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.roles (id, nombre, descripcion, activo, created_at, updated_at) FROM stdin;
1	administrador	Acceso total al sistema	t	2026-03-05 01:45:53.456908	2026-03-05 01:45:53.456908
2	cajero	Cobros y cierre de caja	t	2026-03-05 01:45:53.456908	2026-03-05 01:45:53.456908
3	mesero	Toma de pedidos y mesas	t	2026-03-05 01:45:53.456908	2026-03-05 01:45:53.456908
\.


--
-- TOC entry 5372 (class 0 OID 27382)
-- Dependencies: 259
-- Data for Name: tickets_cocina; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.tickets_cocina (id, orden_id, tipo_ticket, impreso, fecha_impresion, activo, created_at) FROM stdin;
1	2	pedido_cocina	f	\N	t	2026-03-05 21:18:27.991795
2	3	pedido_cocina	f	\N	t	2026-03-14 23:34:46.53758
3	1	pedido_cocina	f	\N	t	2026-03-14 23:53:04.565241
4	1	pedido_cocina	f	\N	t	2026-03-14 23:53:34.929718
5	4	pedido_cocina	f	\N	t	2026-03-15 00:04:35.306936
6	4	pedido_cocina	f	\N	t	2026-03-15 00:05:03.791633
7	5	pedido_cocina	f	\N	t	2026-03-16 20:41:02.706621
8	5	pedido_cocina	f	\N	t	2026-03-16 20:44:13.208842
9	1	pedido_cocina	f	\N	t	2026-03-16 20:46:57.105077
10	6	pedido_cocina	f	\N	t	2026-03-16 21:29:33.32478
11	6	venta_cliente	f	\N	t	2026-03-16 22:38:17.585405
12	1	venta_cliente	f	\N	t	2026-03-16 22:43:52.621924
13	5	venta_cliente	f	\N	t	2026-03-16 22:44:18.681556
14	4	venta_cliente	f	\N	t	2026-03-16 22:44:37.554278
15	3	venta_cliente	f	\N	t	2026-03-16 22:44:57.510359
16	2	venta_cliente	f	\N	t	2026-03-16 22:45:06.805032
17	7	pedido_cocina	f	\N	t	2026-03-16 22:47:52.447479
18	7	venta_cliente	f	\N	t	2026-03-16 22:48:41.254434
19	8	pedido_cocina	f	\N	t	2026-03-16 23:37:54.56209
20	8	venta_cliente	f	\N	t	2026-03-16 23:40:20.131312
21	9	pedido_cocina	f	\N	t	2026-03-17 19:07:54.981787
22	9	venta_cliente	f	\N	t	2026-03-17 19:08:51.074908
23	10	pedido_cocina	f	\N	t	2026-03-17 19:11:38.46747
24	10	venta_cliente	f	\N	t	2026-03-17 19:11:55.590398
25	11	pedido_cocina	f	\N	t	2026-03-27 01:38:45.886353
26	11	pedido_cocina	f	\N	t	2026-03-27 01:39:47.981906
27	11	venta_cliente	f	\N	t	2026-03-27 01:40:35.842585
28	12	pedido_cocina	f	\N	t	2026-03-27 02:02:10.474809
29	12	pedido_cocina	f	\N	t	2026-03-27 02:13:01.162898
30	13	pedido_cocina	f	\N	t	2026-03-29 19:36:04.400095
31	12	venta_cliente	f	\N	t	2026-03-29 19:40:14.285577
32	14	pedido_cocina	f	\N	t	2026-03-29 21:17:28.661176
33	15	pedido_cocina	f	\N	t	2026-03-30 01:07:25.077283
34	13	venta_cliente	f	\N	t	2026-03-30 01:28:55.904315
35	14	venta_cliente	f	\N	t	2026-03-30 01:29:09.6299
36	15	pedido_cocina	f	\N	t	2026-03-30 02:15:56.727922
37	16	pedido_cocina	f	\N	t	2026-03-30 02:20:39.95759
38	17	pedido_cocina	f	\N	t	2026-03-30 02:38:13.940421
39	18	pedido_cocina	f	\N	t	2026-03-30 03:39:51.697652
40	18	pedido_cocina	f	\N	t	2026-03-30 03:40:22.705221
41	17	pedido_cocina	f	\N	t	2026-03-30 04:24:22.631037
42	17	pedido_cocina	f	\N	t	2026-03-30 04:31:57.538265
43	16	pedido_cocina	f	\N	t	2026-03-30 04:33:35.726866
44	18	pedido_cocina	f	\N	t	2026-03-30 04:34:13.511139
45	16	pedido_cocina	f	\N	t	2026-03-30 04:46:01.861968
46	15	pedido_cocina	f	\N	t	2026-03-30 04:50:21.458942
47	18	pedido_cocina	f	\N	t	2026-03-30 04:53:52.518176
48	18	venta_cliente	f	\N	t	2026-03-30 05:04:04.399845
49	17	venta_cliente	f	\N	t	2026-03-30 05:04:22.837114
50	16	venta_cliente	f	\N	t	2026-03-30 05:04:38.897121
51	15	venta_cliente	f	\N	t	2026-03-30 05:04:54.83735
52	19	pedido_cocina	f	\N	t	2026-03-30 05:32:17.010545
53	20	pedido_cocina	f	\N	t	2026-03-30 05:34:59.387388
\.


--
-- TOC entry 5336 (class 0 OID 26944)
-- Dependencies: 223
-- Data for Name: usuarios; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.usuarios (id, nombre, usuario, password, correo, rol_id, activo, created_at, updated_at) FROM stdin;
1	Administrador	admin	$2b$12$2sotqJ6FjZ6Xf3NFFUPKGeWt69Z4krgnPGo0T5QLsI5doorgokRCa	\N	1	t	2026-03-05 02:53:57.920824	2026-03-05 02:53:57.920824
3	Cristian Pérez	Cperez	$2b$12$e0yBrz5Hw2tehRactpBxwOT8q699wjzT4tamkRvEnQzVbFwhz0Z5a	cristian@gmail.com	3	t	2026-03-29 19:33:09.935268	2026-03-29 19:33:09.935268
2	Martin Florez	mflorez	$2b$12$EVzDxBWholZGGmetT8DoUOKaRp.A2gMNkvpiXG7WqyHUL8px0KXJS	martin@gmail.com	2	t	2026-03-29 19:30:17.931363	2026-03-29 20:19:53.171745
4	Gino Risco 	gino	$2b$12$MzKp9oomjV5pG0yjt2Ai4ukOMN3/bqDdIj94fMjgskF5naIrR8wM6	gino@gmail.com	3	t	2026-03-30 03:03:28.22213	2026-03-30 03:03:28.22213
\.


--
-- TOC entry 5350 (class 0 OID 27113)
-- Dependencies: 237
-- Data for Name: ventas; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.ventas (id, orden_id, cajero_id, numero_ticket, subtotal, igv, descuento, total, metodo_pago, monto_pagado, activo, created_at, updated_at) FROM stdin;
14	6	1	T-20260316-0014	37.00	5.64	0.00	37.00	efectivo	37.00	t	2026-03-16 22:38:17.585405	2026-03-16 22:38:17.585405
15	1	1	T-20260316-0015	30.00	4.58	0.00	30.00	yape	30.00	t	2026-03-16 22:43:52.621924	2026-03-16 22:43:52.621924
16	5	1	T-20260316-0016	30.00	4.58	0.00	30.00	efectivo	30.00	t	2026-03-16 22:44:18.681556	2026-03-16 22:44:18.681556
17	4	1	T-20260316-0017	25.00	3.81	0.00	25.00	efectivo	25.00	t	2026-03-16 22:44:37.554278	2026-03-16 22:44:37.554278
18	3	1	T-20260316-0018	26.00	3.97	0.00	26.00	efectivo	50.00	t	2026-03-16 22:44:57.510359	2026-03-16 22:44:57.510359
19	2	1	T-20260316-0019	3.00	0.46	0.00	3.00	efectivo	3.00	t	2026-03-16 22:45:06.805032	2026-03-16 22:45:06.805032
20	7	1	T-20260316-0020	24.00	3.66	0.00	24.00	efectivo	24.00	t	2026-03-16 22:48:41.254434	2026-03-16 22:48:41.254434
21	8	1	T-20260316-0021	28.00	4.27	0.00	28.00	efectivo	28.00	t	2026-03-16 23:40:20.131312	2026-03-16 23:40:20.131312
22	9	1	T-20260317-0022	27.00	4.12	0.00	27.00	plin	27.00	t	2026-03-17 19:08:51.074908	2026-03-17 19:08:51.074908
23	10	1	T-20260317-0023	35.00	5.34	0.00	35.00	yape	35.00	t	2026-03-17 19:11:55.590398	2026-03-17 19:11:55.590398
24	11	1	T-20260327-0024	33.00	5.03	0.00	33.00	efectivo	50.00	t	2026-03-27 01:40:35.842585	2026-03-27 01:40:35.842585
25	12	2	T-20260329-0025	31.00	4.73	0.00	31.00	efectivo	31.00	t	2026-03-29 19:40:14.285577	2026-03-29 19:40:14.285577
26	13	1	T-20260330-0026	20.00	3.05	0.00	20.00	yape	20.00	t	2026-03-30 01:28:55.904315	2026-03-30 01:28:55.904315
27	14	1	T-20260330-0027	15.00	2.29	0.00	15.00	plin	15.00	t	2026-03-30 01:29:09.6299	2026-03-30 01:29:09.6299
28	18	1	T-20260330-0028	44.00	6.71	0.00	44.00	efectivo	44.00	t	2026-03-30 05:04:04.399845	2026-03-30 05:04:04.399845
29	17	1	T-20260330-0029	47.00	7.17	0.00	47.00	efectivo	50.00	t	2026-03-30 05:04:22.837114	2026-03-30 05:04:22.837114
30	16	1	T-20260330-0030	36.00	5.49	0.00	36.00	yape	36.00	t	2026-03-30 05:04:38.897121	2026-03-30 05:04:38.897121
31	15	1	T-20260330-0031	40.00	6.10	0.00	40.00	yape	40.00	t	2026-03-30 05:04:54.83735	2026-03-30 05:04:54.83735
\.


--
-- TOC entry 5352 (class 0 OID 27147)
-- Dependencies: 239
-- Data for Name: ventas_detalle; Type: TABLE DATA; Schema: pos; Owner: postgres
--

COPY pos.ventas_detalle (id, venta_id, producto_id, cantidad, precio, es_incluido_menu, activo, created_at) FROM stdin;
26	14	8	1	15.00	f	t	2026-03-16 22:38:17.585405
27	14	1	1	10.00	f	t	2026-03-16 22:38:17.585405
28	14	11	1	12.00	f	t	2026-03-16 22:38:17.585405
29	15	2	1	3.00	f	t	2026-03-16 22:43:52.621924
30	15	8	1	15.00	f	t	2026-03-16 22:43:52.621924
31	15	6	1	12.00	f	t	2026-03-16 22:43:52.621924
32	16	2	1	3.00	f	t	2026-03-16 22:44:18.681556
33	16	8	1	15.00	f	t	2026-03-16 22:44:18.681556
34	16	6	1	12.00	f	t	2026-03-16 22:44:18.681556
35	17	6	1	12.00	f	t	2026-03-16 22:44:37.554278
36	17	10	1	13.00	f	t	2026-03-16 22:44:37.554278
37	18	2	1	3.00	f	t	2026-03-16 22:44:57.510359
38	18	1	1	10.00	f	t	2026-03-16 22:44:57.510359
39	18	10	1	13.00	f	t	2026-03-16 22:44:57.510359
40	19	2	1	3.00	f	t	2026-03-16 22:45:06.805032
41	20	6	1	12.00	f	t	2026-03-16 22:48:41.254434
42	20	11	1	12.00	f	t	2026-03-16 22:48:41.254434
43	21	2	1	3.00	f	t	2026-03-16 23:40:20.131312
44	21	6	1	12.00	f	t	2026-03-16 23:40:20.131312
45	21	10	1	13.00	f	t	2026-03-16 23:40:20.131312
46	22	8	1	15.00	f	t	2026-03-17 19:08:51.074908
47	22	6	1	12.00	f	t	2026-03-17 19:08:51.074908
48	23	8	1	15.00	f	t	2026-03-17 19:11:55.590398
49	23	5	1	20.00	f	t	2026-03-17 19:11:55.590398
50	24	6	1	12.00	f	t	2026-03-27 01:40:35.842585
51	24	8	1	15.00	f	t	2026-03-27 01:40:35.842585
52	24	2	1	3.00	f	t	2026-03-27 01:40:35.842585
53	24	2	1	3.00	f	t	2026-03-27 01:40:35.842585
54	25	2	1	3.00	f	t	2026-03-29 19:40:14.285577
55	25	5	1	20.00	f	t	2026-03-29 19:40:14.285577
56	25	14	1	8.00	f	t	2026-03-29 19:40:14.285577
57	26	6	1	12.00	f	t	2026-03-30 01:28:55.904315
58	26	14	1	8.00	f	t	2026-03-30 01:28:55.904315
59	27	6	1	12.00	f	t	2026-03-30 01:29:09.6299
60	27	2	1	3.00	f	t	2026-03-30 01:29:09.6299
61	28	6	1	12.00	f	t	2026-03-30 05:04:04.399845
62	28	12	1	4.00	f	t	2026-03-30 05:04:04.399845
63	28	10	1	13.00	f	t	2026-03-30 05:04:04.399845
64	28	8	1	15.00	f	t	2026-03-30 05:04:04.399845
65	29	12	1	4.00	f	t	2026-03-30 05:04:22.837114
66	29	2	1	3.00	f	t	2026-03-30 05:04:22.837114
67	29	5	1	20.00	f	t	2026-03-30 05:04:22.837114
68	29	5	1	20.00	f	t	2026-03-30 05:04:22.837114
69	30	15	1	2.00	f	t	2026-03-30 05:04:38.897121
70	30	1	1	10.00	f	t	2026-03-30 05:04:38.897121
71	30	4	1	12.00	f	t	2026-03-30 05:04:38.897121
72	30	11	1	12.00	f	t	2026-03-30 05:04:38.897121
73	31	12	1	4.00	f	t	2026-03-30 05:04:54.83735
74	31	14	1	8.00	f	t	2026-03-30 05:04:54.83735
75	31	11	1	12.00	f	t	2026-03-30 05:04:54.83735
76	31	12	1	4.00	f	t	2026-03-30 05:04:54.83735
77	31	11	1	12.00	f	t	2026-03-30 05:04:54.83735
\.


--
-- TOC entry 5408 (class 0 OID 0)
-- Dependencies: 230
-- Name: alertas_stock_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.alertas_stock_id_seq', 1, false);


--
-- TOC entry 5409 (class 0 OID 0)
-- Dependencies: 226
-- Name: categorias_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.categorias_id_seq', 11, true);


--
-- TOC entry 5410 (class 0 OID 0)
-- Dependencies: 250
-- Name: compras_detalle_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.compras_detalle_id_seq', 10, true);


--
-- TOC entry 5411 (class 0 OID 0)
-- Dependencies: 248
-- Name: compras_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.compras_id_seq', 11, true);


--
-- TOC entry 5412 (class 0 OID 0)
-- Dependencies: 256
-- Name: kardex_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.kardex_id_seq', 25, true);


--
-- TOC entry 5413 (class 0 OID 0)
-- Dependencies: 228
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.productos_id_seq', 21, true);


--
-- TOC entry 5414 (class 0 OID 0)
-- Dependencies: 246
-- Name: proveedores_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.proveedores_id_seq', 2, true);


--
-- TOC entry 5415 (class 0 OID 0)
-- Dependencies: 254
-- Name: salidas_cocina_detalle_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.salidas_cocina_detalle_id_seq', 6, true);


--
-- TOC entry 5416 (class 0 OID 0)
-- Dependencies: 252
-- Name: salidas_cocina_id_seq; Type: SEQUENCE SET; Schema: inventario; Owner: postgres
--

SELECT pg_catalog.setval('inventario.salidas_cocina_id_seq', 3, true);


--
-- TOC entry 5417 (class 0 OID 0)
-- Dependencies: 240
-- Name: caja_aperturas_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.caja_aperturas_id_seq', 11, true);


--
-- TOC entry 5418 (class 0 OID 0)
-- Dependencies: 244
-- Name: caja_cierres_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.caja_cierres_id_seq', 11, true);


--
-- TOC entry 5419 (class 0 OID 0)
-- Dependencies: 242
-- Name: caja_movimientos_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.caja_movimientos_id_seq', 71, true);


--
-- TOC entry 5420 (class 0 OID 0)
-- Dependencies: 224
-- Name: mesas_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.mesas_id_seq', 6, true);


--
-- TOC entry 5421 (class 0 OID 0)
-- Dependencies: 234
-- Name: orden_detalles_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.orden_detalles_id_seq', 67, true);


--
-- TOC entry 5422 (class 0 OID 0)
-- Dependencies: 232
-- Name: ordenes_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.ordenes_id_seq', 20, true);


--
-- TOC entry 5423 (class 0 OID 0)
-- Dependencies: 220
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.roles_id_seq', 3, true);


--
-- TOC entry 5424 (class 0 OID 0)
-- Dependencies: 258
-- Name: tickets_cocina_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.tickets_cocina_id_seq', 53, true);


--
-- TOC entry 5425 (class 0 OID 0)
-- Dependencies: 222
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.usuarios_id_seq', 4, true);


--
-- TOC entry 5426 (class 0 OID 0)
-- Dependencies: 238
-- Name: ventas_detalle_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.ventas_detalle_id_seq', 77, true);


--
-- TOC entry 5427 (class 0 OID 0)
-- Dependencies: 236
-- Name: ventas_id_seq; Type: SEQUENCE SET; Schema: pos; Owner: postgres
--

SELECT pg_catalog.setval('pos.ventas_id_seq', 31, true);


--
-- TOC entry 5428 (class 0 OID 0)
-- Dependencies: 217
-- Name: seq_comanda; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.seq_comanda', 20, true);


--
-- TOC entry 5429 (class 0 OID 0)
-- Dependencies: 219
-- Name: seq_compra; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.seq_compra', 11, true);


--
-- TOC entry 5430 (class 0 OID 0)
-- Dependencies: 218
-- Name: seq_ticket; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.seq_ticket', 31, true);


--
-- TOC entry 5074 (class 2606 OID 27033)
-- Name: alertas_stock alertas_stock_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_pkey PRIMARY KEY (id);


--
-- TOC entry 5064 (class 2606 OID 26994)
-- Name: categorias categorias_nombre_key; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.categorias
    ADD CONSTRAINT categorias_nombre_key UNIQUE (nombre);


--
-- TOC entry 5066 (class 2606 OID 26992)
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- TOC entry 5118 (class 2606 OID 27301)
-- Name: compras_detalle compras_detalle_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras_detalle
    ADD CONSTRAINT compras_detalle_pkey PRIMARY KEY (id);


--
-- TOC entry 5113 (class 2606 OID 27279)
-- Name: compras compras_numero_compra_key; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_numero_compra_key UNIQUE (numero_compra);


--
-- TOC entry 5115 (class 2606 OID 27277)
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- TOC entry 5129 (class 2606 OID 27365)
-- Name: kardex kardex_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_pkey PRIMARY KEY (id);


--
-- TOC entry 5072 (class 2606 OID 27016)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- TOC entry 5109 (class 2606 OID 27258)
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- TOC entry 5111 (class 2606 OID 27260)
-- Name: proveedores proveedores_ruc_key; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.proveedores
    ADD CONSTRAINT proveedores_ruc_key UNIQUE (ruc);


--
-- TOC entry 5123 (class 2606 OID 27346)
-- Name: salidas_cocina_detalle salidas_cocina_detalle_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle
    ADD CONSTRAINT salidas_cocina_detalle_pkey PRIMARY KEY (id);


--
-- TOC entry 5121 (class 2606 OID 27324)
-- Name: salidas_cocina salidas_cocina_pkey; Type: CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina
    ADD CONSTRAINT salidas_cocina_pkey PRIMARY KEY (id);


--
-- TOC entry 5099 (class 2606 OID 27182)
-- Name: caja_aperturas caja_aperturas_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_aperturas
    ADD CONSTRAINT caja_aperturas_pkey PRIMARY KEY (id);


--
-- TOC entry 5105 (class 2606 OID 27236)
-- Name: caja_cierres caja_cierres_caja_id_key; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_caja_id_key UNIQUE (caja_id);


--
-- TOC entry 5107 (class 2606 OID 27234)
-- Name: caja_cierres caja_cierres_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_pkey PRIMARY KEY (id);


--
-- TOC entry 5101 (class 2606 OID 27199)
-- Name: caja_movimientos caja_movimientos_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_pkey PRIMARY KEY (id);


--
-- TOC entry 5060 (class 2606 OID 26980)
-- Name: mesas mesas_numero_key; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.mesas
    ADD CONSTRAINT mesas_numero_key UNIQUE (numero);


--
-- TOC entry 5062 (class 2606 OID 26978)
-- Name: mesas mesas_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.mesas
    ADD CONSTRAINT mesas_pkey PRIMARY KEY (id);


--
-- TOC entry 5087 (class 2606 OID 27093)
-- Name: orden_detalles orden_detalles_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_pkey PRIMARY KEY (id);


--
-- TOC entry 5082 (class 2606 OID 27064)
-- Name: ordenes ordenes_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ordenes
    ADD CONSTRAINT ordenes_pkey PRIMARY KEY (id);


--
-- TOC entry 5050 (class 2606 OID 26942)
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- TOC entry 5052 (class 2606 OID 26940)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 5132 (class 2606 OID 27391)
-- Name: tickets_cocina tickets_cocina_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.tickets_cocina
    ADD CONSTRAINT tickets_cocina_pkey PRIMARY KEY (id);


--
-- TOC entry 5054 (class 2606 OID 26960)
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- TOC entry 5056 (class 2606 OID 26956)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5058 (class 2606 OID 26958)
-- Name: usuarios usuarios_usuario_key; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_usuario_key UNIQUE (usuario);


--
-- TOC entry 5097 (class 2606 OID 27158)
-- Name: ventas_detalle ventas_detalle_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas_detalle
    ADD CONSTRAINT ventas_detalle_pkey PRIMARY KEY (id);


--
-- TOC entry 5091 (class 2606 OID 27135)
-- Name: ventas ventas_numero_ticket_key; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_numero_ticket_key UNIQUE (numero_ticket);


--
-- TOC entry 5093 (class 2606 OID 27133)
-- Name: ventas ventas_orden_id_key; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_orden_id_key UNIQUE (orden_id);


--
-- TOC entry 5095 (class 2606 OID 27131)
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- TOC entry 5075 (class 1259 OID 27404)
-- Name: idx_alertas_no_atendidas; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_alertas_no_atendidas ON inventario.alertas_stock USING btree (producto_id) WHERE (atendida = false);


--
-- TOC entry 5076 (class 1259 OID 27050)
-- Name: idx_alertas_stock_fecha; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_alertas_stock_fecha ON inventario.alertas_stock USING btree (created_at DESC);


--
-- TOC entry 5077 (class 1259 OID 27049)
-- Name: idx_alertas_stock_producto; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_alertas_stock_producto ON inventario.alertas_stock USING btree (producto_id, atendida);


--
-- TOC entry 5116 (class 1259 OID 27412)
-- Name: idx_compras_proveedor; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_compras_proveedor ON inventario.compras USING btree (proveedor_id);


--
-- TOC entry 5124 (class 1259 OID 27399)
-- Name: idx_kardex_fecha; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_kardex_fecha ON inventario.kardex USING btree (created_at DESC);


--
-- TOC entry 5125 (class 1259 OID 27398)
-- Name: idx_kardex_producto; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_kardex_producto ON inventario.kardex USING btree (producto_id);


--
-- TOC entry 5126 (class 1259 OID 27400)
-- Name: idx_kardex_referencia; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_kardex_referencia ON inventario.kardex USING btree (referencia_tipo, referencia_id);


--
-- TOC entry 5127 (class 1259 OID 27401)
-- Name: idx_kardex_reversion; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_kardex_reversion ON inventario.kardex USING btree (reversion_de) WHERE (reversion_de IS NOT NULL);


--
-- TOC entry 5067 (class 1259 OID 27471)
-- Name: idx_productos_activo; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_productos_activo ON inventario.productos USING btree (activo) WHERE (activo = false);


--
-- TOC entry 5068 (class 1259 OID 27473)
-- Name: idx_productos_disponible_menu; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_productos_disponible_menu ON inventario.productos USING btree (disponible_en_menu) WHERE (disponible_en_menu = true);


--
-- TOC entry 5069 (class 1259 OID 27402)
-- Name: idx_productos_stock_bajo; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_productos_stock_bajo ON inventario.productos USING btree (stock_actual, stock_minimo) WHERE ((control_stock = true) AND (activo = true));


--
-- TOC entry 5070 (class 1259 OID 27403)
-- Name: idx_productos_tipo; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_productos_tipo ON inventario.productos USING btree (tipo, control_stock);


--
-- TOC entry 5119 (class 1259 OID 27413)
-- Name: idx_salidas_cocina_fecha; Type: INDEX; Schema: inventario; Owner: postgres
--

CREATE INDEX idx_salidas_cocina_fecha ON inventario.salidas_cocina USING btree (created_at DESC);


--
-- TOC entry 5102 (class 1259 OID 27410)
-- Name: idx_caja_mov_caja; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_caja_mov_caja ON pos.caja_movimientos USING btree (caja_id);


--
-- TOC entry 5103 (class 1259 OID 27411)
-- Name: idx_caja_mov_fecha; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_caja_mov_fecha ON pos.caja_movimientos USING btree (created_at DESC);


--
-- TOC entry 5083 (class 1259 OID 27414)
-- Name: idx_orden_detalle_menu; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_orden_detalle_menu ON pos.orden_detalles USING btree (grupo_menu_id) WHERE (es_incluido_menu = true);


--
-- TOC entry 5084 (class 1259 OID 27479)
-- Name: idx_orden_detalles_enviado_cocina; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_orden_detalles_enviado_cocina ON pos.orden_detalles USING btree (enviado_cocina) WHERE (enviado_cocina = false);


--
-- TOC entry 5085 (class 1259 OID 27478)
-- Name: idx_orden_detalles_orden_id; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_orden_detalles_orden_id ON pos.orden_detalles USING btree (orden_id);


--
-- TOC entry 5078 (class 1259 OID 27406)
-- Name: idx_ordenes_estado; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_ordenes_estado ON pos.ordenes USING btree (estado);


--
-- TOC entry 5079 (class 1259 OID 27407)
-- Name: idx_ordenes_fecha; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_ordenes_fecha ON pos.ordenes USING btree (created_at DESC);


--
-- TOC entry 5080 (class 1259 OID 27405)
-- Name: idx_ordenes_mesa; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_ordenes_mesa ON pos.ordenes USING btree (mesa_id);


--
-- TOC entry 5130 (class 1259 OID 27397)
-- Name: idx_tickets_no_impresos; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_tickets_no_impresos ON pos.tickets_cocina USING btree (orden_id) WHERE ((impreso = false) AND (activo = true));


--
-- TOC entry 5088 (class 1259 OID 27409)
-- Name: idx_ventas_cajero; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_ventas_cajero ON pos.ventas USING btree (cajero_id);


--
-- TOC entry 5089 (class 1259 OID 27408)
-- Name: idx_ventas_fecha; Type: INDEX; Schema: pos; Owner: postgres
--

CREATE INDEX idx_ventas_fecha ON pos.ventas USING btree (created_at DESC);


--
-- TOC entry 5178 (class 2620 OID 27420)
-- Name: compras_detalle trg_after_compra_detalle_insert; Type: TRIGGER; Schema: inventario; Owner: postgres
--

CREATE TRIGGER trg_after_compra_detalle_insert AFTER INSERT ON inventario.compras_detalle FOR EACH ROW EXECUTE FUNCTION inventario.trg_compra_detalle_kardex();


--
-- TOC entry 5170 (class 2620 OID 27023)
-- Name: productos trg_before_producto_update; Type: TRIGGER; Schema: inventario; Owner: postgres
--

CREATE TRIGGER trg_before_producto_update BEFORE UPDATE ON inventario.productos FOR EACH ROW EXECUTE FUNCTION inventario.trg_proteger_stock();


--
-- TOC entry 5179 (class 2620 OID 27422)
-- Name: salidas_cocina trg_before_salida_cocina_update; Type: TRIGGER; Schema: inventario; Owner: postgres
--

CREATE TRIGGER trg_before_salida_cocina_update BEFORE UPDATE ON inventario.salidas_cocina FOR EACH ROW EXECUTE FUNCTION inventario.trg_salida_cocina_aprobacion();


--
-- TOC entry 5169 (class 2620 OID 27430)
-- Name: categorias trg_updated_at_categorias; Type: TRIGGER; Schema: inventario; Owner: postgres
--

CREATE TRIGGER trg_updated_at_categorias BEFORE UPDATE ON inventario.categorias FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5177 (class 2620 OID 27432)
-- Name: compras trg_updated_at_compras; Type: TRIGGER; Schema: inventario; Owner: postgres
--

CREATE TRIGGER trg_updated_at_compras BEFORE UPDATE ON inventario.compras FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5176 (class 2620 OID 27431)
-- Name: proveedores trg_updated_at_proveedores; Type: TRIGGER; Schema: inventario; Owner: postgres
--

CREATE TRIGGER trg_updated_at_proveedores BEFORE UPDATE ON inventario.proveedores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5174 (class 2620 OID 27418)
-- Name: ventas_detalle trg_after_venta_detalle_insert; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_after_venta_detalle_insert AFTER INSERT ON pos.ventas_detalle FOR EACH ROW EXECUTE FUNCTION pos.trg_venta_detalle_kardex();


--
-- TOC entry 5172 (class 2620 OID 27111)
-- Name: orden_detalles trg_orden_detalle_ciclo; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_orden_detalle_ciclo BEFORE INSERT OR UPDATE ON pos.orden_detalles FOR EACH ROW EXECUTE FUNCTION pos.trg_validar_ciclo_menu_fn();


--
-- TOC entry 5175 (class 2620 OID 27428)
-- Name: caja_aperturas trg_updated_at_caja_aperturas; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_updated_at_caja_aperturas BEFORE UPDATE ON pos.caja_aperturas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5168 (class 2620 OID 27426)
-- Name: mesas trg_updated_at_mesas; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_updated_at_mesas BEFORE UPDATE ON pos.mesas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5171 (class 2620 OID 27427)
-- Name: ordenes trg_updated_at_ordenes; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_updated_at_ordenes BEFORE UPDATE ON pos.ordenes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5166 (class 2620 OID 27424)
-- Name: roles trg_updated_at_roles; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_updated_at_roles BEFORE UPDATE ON pos.roles FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5167 (class 2620 OID 27425)
-- Name: usuarios trg_updated_at_usuarios; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_updated_at_usuarios BEFORE UPDATE ON pos.usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5173 (class 2620 OID 27429)
-- Name: ventas trg_updated_at_ventas; Type: TRIGGER; Schema: pos; Owner: postgres
--

CREATE TRIGGER trg_updated_at_ventas BEFORE UPDATE ON pos.ventas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- TOC entry 5135 (class 2606 OID 27044)
-- Name: alertas_stock alertas_stock_atendida_por_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_atendida_por_fkey FOREIGN KEY (atendida_por) REFERENCES pos.usuarios(id);


--
-- TOC entry 5136 (class 2606 OID 27034)
-- Name: alertas_stock alertas_stock_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5137 (class 2606 OID 27039)
-- Name: alertas_stock alertas_stock_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.alertas_stock
    ADD CONSTRAINT alertas_stock_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5153 (class 2606 OID 27487)
-- Name: compras compras_caja_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_caja_movimiento_id_fkey FOREIGN KEY (caja_movimiento_id) REFERENCES pos.caja_movimientos(id);


--
-- TOC entry 5156 (class 2606 OID 27302)
-- Name: compras_detalle compras_detalle_compra_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras_detalle
    ADD CONSTRAINT compras_detalle_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES inventario.compras(id) ON DELETE CASCADE;


--
-- TOC entry 5157 (class 2606 OID 27307)
-- Name: compras_detalle compras_detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras_detalle
    ADD CONSTRAINT compras_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5154 (class 2606 OID 27280)
-- Name: compras compras_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES inventario.proveedores(id);


--
-- TOC entry 5155 (class 2606 OID 27285)
-- Name: compras compras_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.compras
    ADD CONSTRAINT compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5162 (class 2606 OID 27366)
-- Name: kardex kardex_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5163 (class 2606 OID 27376)
-- Name: kardex kardex_reversion_de_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_reversion_de_fkey FOREIGN KEY (reversion_de) REFERENCES inventario.kardex(id);


--
-- TOC entry 5164 (class 2606 OID 27371)
-- Name: kardex kardex_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.kardex
    ADD CONSTRAINT kardex_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5134 (class 2606 OID 27017)
-- Name: productos productos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.productos
    ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES inventario.categorias(id);


--
-- TOC entry 5158 (class 2606 OID 27330)
-- Name: salidas_cocina salidas_cocina_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina
    ADD CONSTRAINT salidas_cocina_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES pos.usuarios(id);


--
-- TOC entry 5160 (class 2606 OID 27352)
-- Name: salidas_cocina_detalle salidas_cocina_detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle
    ADD CONSTRAINT salidas_cocina_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5161 (class 2606 OID 27347)
-- Name: salidas_cocina_detalle salidas_cocina_detalle_salida_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina_detalle
    ADD CONSTRAINT salidas_cocina_detalle_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES inventario.salidas_cocina(id) ON DELETE CASCADE;


--
-- TOC entry 5159 (class 2606 OID 27325)
-- Name: salidas_cocina salidas_cocina_usuario_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: postgres
--

ALTER TABLE ONLY inventario.salidas_cocina
    ADD CONSTRAINT salidas_cocina_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5147 (class 2606 OID 27183)
-- Name: caja_aperturas caja_aperturas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_aperturas
    ADD CONSTRAINT caja_aperturas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5151 (class 2606 OID 27237)
-- Name: caja_cierres caja_cierres_caja_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES pos.caja_aperturas(id);


--
-- TOC entry 5152 (class 2606 OID 27242)
-- Name: caja_cierres caja_cierres_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_cierres
    ADD CONSTRAINT caja_cierres_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5148 (class 2606 OID 27200)
-- Name: caja_movimientos caja_movimientos_caja_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES pos.caja_aperturas(id);


--
-- TOC entry 5149 (class 2606 OID 27210)
-- Name: caja_movimientos caja_movimientos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5150 (class 2606 OID 27205)
-- Name: caja_movimientos caja_movimientos_venta_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.caja_movimientos
    ADD CONSTRAINT caja_movimientos_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES pos.ventas(id);


--
-- TOC entry 5140 (class 2606 OID 27104)
-- Name: orden_detalles orden_detalles_grupo_menu_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_grupo_menu_id_fkey FOREIGN KEY (grupo_menu_id) REFERENCES pos.orden_detalles(id);


--
-- TOC entry 5141 (class 2606 OID 27094)
-- Name: orden_detalles orden_detalles_orden_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES pos.ordenes(id) ON DELETE CASCADE;


--
-- TOC entry 5142 (class 2606 OID 27099)
-- Name: orden_detalles orden_detalles_producto_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.orden_detalles
    ADD CONSTRAINT orden_detalles_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5138 (class 2606 OID 27065)
-- Name: ordenes ordenes_mesa_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ordenes
    ADD CONSTRAINT ordenes_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES pos.mesas(id);


--
-- TOC entry 5139 (class 2606 OID 27070)
-- Name: ordenes ordenes_mesero_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ordenes
    ADD CONSTRAINT ordenes_mesero_id_fkey FOREIGN KEY (mesero_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5165 (class 2606 OID 27392)
-- Name: tickets_cocina tickets_cocina_orden_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.tickets_cocina
    ADD CONSTRAINT tickets_cocina_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES pos.ordenes(id);


--
-- TOC entry 5133 (class 2606 OID 26961)
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES pos.roles(id);


--
-- TOC entry 5143 (class 2606 OID 27141)
-- Name: ventas ventas_cajero_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_cajero_id_fkey FOREIGN KEY (cajero_id) REFERENCES pos.usuarios(id);


--
-- TOC entry 5145 (class 2606 OID 27164)
-- Name: ventas_detalle ventas_detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas_detalle
    ADD CONSTRAINT ventas_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES inventario.productos(id);


--
-- TOC entry 5146 (class 2606 OID 27159)
-- Name: ventas_detalle ventas_detalle_venta_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas_detalle
    ADD CONSTRAINT ventas_detalle_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES pos.ventas(id) ON DELETE CASCADE;


--
-- TOC entry 5144 (class 2606 OID 27136)
-- Name: ventas ventas_orden_id_fkey; Type: FK CONSTRAINT; Schema: pos; Owner: postgres
--

ALTER TABLE ONLY pos.ventas
    ADD CONSTRAINT ventas_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES pos.ordenes(id);


-- Completed on 2026-03-30 23:58:19

--
-- PostgreSQL database dump complete
--


