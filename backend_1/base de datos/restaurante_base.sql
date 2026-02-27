-- 1. TABLAS MAESTRAS
-- ================================================================

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_hash_algorithm VARCHAR(20) DEFAULT 'bcrypt',
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'cajero', 'mesero', 'cocina')),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP WITH TIME ZONE
);

CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255),
    orden_mostrar INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    categoria_id INT REFERENCES categorias(id),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_venta NUMERIC(10,2) NOT NULL CHECK (precio_venta >= 0),
    costo_promedio NUMERIC(10,2) DEFAULT 0,
    tipo VARCHAR(20) DEFAULT 'plato' CHECK (tipo IN ('plato', 'bebida', 'complemento')),
    requiere_cocina BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proveedores (
    id SERIAL PRIMARY KEY,
    nombre_empresa VARCHAR(100) NOT NULL,
    ruc_nit VARCHAR(20),
    contacto VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE insumos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    stock_actual NUMERIC(10,3) DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo NUMERIC(10,3) DEFAULT 0,
    costo_unitario_promedio NUMERIC(10,2) DEFAULT 0,
    proveedor_principal_id INT REFERENCES proveedores(id),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recetas (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    insumo_id INT NOT NULL REFERENCES insumos(id),
    cantidad_requerida NUMERIC(10,3) NOT NULL CHECK (cantidad_requerida > 0),
    unidad_medida_receta VARCHAR(20),
    UNIQUE(producto_id, insumo_id)
);

CREATE TABLE mesas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    capacidad INT DEFAULT 4,
    estado VARCHAR(20) DEFAULT 'libre' CHECK (estado IN ('libre', 'ocupada', 'sucia', 'reservada', 'mantenimiento')),
    ubicacion VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE
);

-- 2. TABLAS DE COMPRAS
-- ================================================================

CREATE TABLE compras (
    id SERIAL PRIMARY KEY,
    proveedor_id INT NOT NULL REFERENCES proveedores(id),
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    fecha_compra TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subtotal NUMERIC(10,2) NOT NULL,
    impuestos NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    numero_comprobante VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'completada' CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
    notas TEXT
);

CREATE TABLE compras_detalles (
    id SERIAL PRIMARY KEY,
    compra_id INT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    insumo_id INT NOT NULL REFERENCES insumos(id),
    cantidad NUMERIC(10,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL
);

-- 3. TABLAS TRANSACCIONALES
-- ================================================================

CREATE TABLE turnos_caja (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    fecha_apertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    monto_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
    monto_final_esperado NUMERIC(10,2),
    monto_final_real NUMERIC(10,2),
    diferencia_caja NUMERIC(10,2),
    observaciones_cierre TEXT,
    estado VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado'))
);

CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    mesa_id INT NOT NULL REFERENCES mesas(id),
    mesero_id INT NOT NULL REFERENCES usuarios(id),
    turno_id INT REFERENCES turnos_caja(id),
    estado VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'cancelado')),
    descuento_global NUMERIC(10,2) DEFAULT 0,
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    notas_generales TEXT
);

CREATE TABLE pedido_detalles (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INT NOT NULL REFERENCES productos(id),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    descuento_item NUMERIC(10,2) DEFAULT 0,
    estado_cocina VARCHAR(20) DEFAULT 'pendiente' CHECK (estado_cocina IN ('pendiente', 'cocinando', 'listo', 'servido', 'cancelado')),
    observaciones TEXT,
    fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_listo TIMESTAMP WITH TIME ZONE,
    usuario_cocina_id INT REFERENCES usuarios(id)
);

CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL REFERENCES pedidos(id),
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'yape', 'plin')),
    referencia_pago VARCHAR(100),
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE kardex (
    id SERIAL PRIMARY KEY,
    insumo_id INT NOT NULL REFERENCES insumos(id),
    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'merma', 'ajuste', 'venta')),
    cantidad NUMERIC(10,3) NOT NULL,
    costo_unitario NUMERIC(10,2),
    saldo_anterior NUMERIC(10,3),
    saldo_nuevo NUMERIC(10,3),
    referencia_tabla VARCHAR(50),
    referencia_id INT,
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    motivo TEXT,
    fecha_movimiento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id INT,
    detalles JSONB,
    ip_origen VARCHAR(45),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. VISTAS SIMPLES 
-- ================================================================

CREATE OR REPLACE VIEW vista_total_pedidos AS
SELECT
    p.id AS pedido_id,
    COALESCE(SUM(pd.subtotal - pd.descuento_item), 0) AS subtotal_calculado,
    p.descuento_global,
    COALESCE(SUM(pd.subtotal - pd.descuento_item), 0) - p.descuento_global AS total_calculado
FROM pedidos p
LEFT JOIN pedido_detalles pd ON p.id = pd.pedido_id AND pd.estado_cocina != 'cancelado'
GROUP BY p.id, p.descuento_global;

-- 5. ÍNDICES 
-- ================================================================

CREATE INDEX idx_pedidos_mesa ON pedidos(mesa_id, estado);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_apertura);
CREATE INDEX idx_pedido_detalles_est ON pedido_detalles(estado_cocina);
CREATE INDEX idx_kardex_insumo ON kardex(insumo_id, fecha_movimiento);
CREATE INDEX idx_pagos_pedido ON pagos(pedido_id);
CREATE INDEX idx_turnos_estado ON turnos_caja(estado);

SELECT * FROM recetas