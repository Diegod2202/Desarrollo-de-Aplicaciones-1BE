-- =========================================================
-- RitmoFit - SQL para 1° Entrega (DB + Tablas + Seeds)
-- Reemplaza por completo tu archivo actual con este contenido
-- =========================================================

DROP DATABASE IF EXISTS ritmofit;
CREATE DATABASE ritmofit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ritmofit;

-- =========================
-- Tabla: users
-- =========================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) NOT NULL UNIQUE,
  photo VARCHAR(255),
  password VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================
-- Tabla: classes
-- =========================
CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  discipline VARCHAR(100) NOT NULL,
  sede VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  cupo INT NOT NULL,
  profesor VARCHAR(100),
  duracion INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================
-- Tabla: reservations
-- =========================
CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  class_id INT NOT NULL,
  status ENUM('confirmada', 'cancelada') NOT NULL DEFAULT 'confirmada',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_res_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT uq_user_class UNIQUE (user_id, class_id)  -- evita reservar la misma clase 2 veces
) ENGINE=InnoDB;

-- =========================
-- Tabla: history
-- =========================
CREATE TABLE history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  class_id INT NOT NULL,
  asistencia_fecha DATETIME NOT NULL,
  CONSTRAINT fk_hist_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_hist_class FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB;

-- =========================
-- Tabla: otps (login por email)
-- =========================
CREATE TABLE otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX (email)
) ENGINE=InnoDB;

-- =========================
-- Datos de prueba (Seeds)
-- =========================

-- Usuario demo para probar login/Reservas/Historial
INSERT INTO users (name, email, photo)
VALUES ('Usuario Demo', 'demo@uade.edu', 'https://picsum.photos/200');

-- NOTA: ponemos fechas a FUTURO para poder reservar en la demo
INSERT INTO classes (name, discipline, sede, fecha, hora, cupo, profesor, duracion) VALUES
('Funcional 18:00', 'Funcional', 'Palermo',  DATE '2025-09-22', TIME '18:00:00', 20, 'Carlos López', 60),
('Yoga 19:00',      'Yoga',      'Belgrano', DATE '2025-09-22', TIME '19:00:00', 15, 'María Pérez', 45),
('Spinning 20:00',  'Spinning',  'Palermo',  DATE '2025-09-23', TIME '20:00:00', 25, 'Juan Martínez', 50);

-- Historial de ejemplo (clase pasada simulada)
-- Si querés, comentá estas líneas si no necesitás mostrar historial aún.
INSERT INTO history (user_id, class_id, asistencia_fecha) VALUES
(2, 1, '2025-09-01 18:05:00');