CREATE DATABASE ritmofit;

USE ritmofit;

-- Usuarios
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE NOT NULL,
  photo VARCHAR(255),
  password VARCHAR(255), -- opcional si más adelante querés login tradicional
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clases
CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  discipline VARCHAR(100),
  sede VARCHAR(100),
  fecha DATE,
  hora TIME,
  cupo INT,
  profesor VARCHAR(100),
  duracion INT
);

-- Reservas
CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  class_id INT,
  status ENUM('confirmada', 'cancelada', 'expirada') DEFAULT 'confirmada',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- Historial (se puede usar reservations + status/fecha)
CREATE TABLE history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  class_id INT,
  asistencia_fecha DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- OTP (para login por mail)
CREATE TABLE otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL
);

INSERT INTO classes (name, discipline, sede, fecha, hora, cupo, profesor, duracion)
VALUES
  ('Funcional 18:00', 'Funcional', 'Palermo', '2025-09-10', '18:00:00', 20, 'Carlos López', 60),
  ('Yoga 19:00', 'Yoga', 'Belgrano', '2025-09-10', '19:00:00', 15, 'María Pérez', 45),
  ('Spinning 20:00', 'Spinning', 'Palermo', '2025-09-11', '20:00:00', 25, 'Juan Martínez', 50);

INSERT INTO history (user_id, class_id, asistencia_fecha)
VALUES
  (1, 1, '2025-09-10 18:05:00'),
  (1, 2, '2025-09-11 19:05:00'),
  (1, 3, '2025-09-15 20:05:00');
  

  -- =========================================================
-- RitmoFit – Base de datos desde cero (MySQL 8+ / MariaDB)
-- =========================================================

-- 0) Crear base (si no existe) y usarla
CREATE DATABASE IF NOT EXISTS ritmofit
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE ritmofit;

-- ---------------------------------------------------------
-- 1) Usuarios
-- ---------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100),
  email      VARCHAR(100) NOT NULL UNIQUE,
  photo      VARCHAR(255),
  password   VARCHAR(255), -- opcional si más adelante querés login tradicional
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 2) Clases  (NOTA: 'cupo' = cupos DISPONIBLES)
-- ---------------------------------------------------------
DROP TABLE IF EXISTS classes;
CREATE TABLE classes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  discipline VARCHAR(100),
  sede       VARCHAR(100),
  fecha      DATE,
  hora       TIME,
  cupo       INT,            -- cupos DISPONIBLES
  profesor   VARCHAR(100),
  duracion   INT             -- minutos
) ENGINE=InnoDB;

-- Índice para búsquedas y validaciones por fecha/hora
CREATE INDEX idx_classes_fecha_hora ON classes (fecha, hora);

-- ---------------------------------------------------------
-- 3) Reservas
-- ---------------------------------------------------------
DROP TABLE IF EXISTS reservations;
CREATE TABLE reservations (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  class_id   INT NOT NULL,
  status     ENUM('confirmada', 'cancelada', 'expirada') DEFAULT 'confirmada',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_user  FOREIGN KEY (user_id)  REFERENCES users(id),
  CONSTRAINT fk_res_class FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB;

-- Evita que un mismo usuario reserve dos veces la misma clase
CREATE UNIQUE INDEX uniq_user_class ON reservations (user_id, class_id);

-- Índice por usuario (listados y validaciones)
CREATE INDEX idx_reservations_user ON reservations (user_id);

-- ---------------------------------------------------------
-- 4) Historial (podría derivarse de reservations + estados/fechas)
-- ---------------------------------------------------------
DROP TABLE IF EXISTS history;
CREATE TABLE history (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  class_id         INT NOT NULL,
  asistencia_fecha DATETIME,
  CONSTRAINT fk_hist_user  FOREIGN KEY (user_id)  REFERENCES users(id),
  CONSTRAINT fk_hist_class FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 5) OTP (login por mail)
-- ---------------------------------------------------------
DROP TABLE IF EXISTS otps;
CREATE TABLE otps (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(100) NOT NULL,
  code       VARCHAR(6)   NOT NULL,
  expires_at DATETIME     NOT NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Seeds de ejemplo
-- ---------------------------------------------------------

-- Usuarios (opcional)
INSERT INTO users (name, email) VALUES
  ('Thiago Russo', 'thiago@example.com'),
  ('Juliana Silva', 'juliana@example.com');

-- Clases: (cupo = cupos disponibles)
INSERT INTO classes (name, discipline, sede, fecha, hora, cupo, profesor, duracion) VALUES
  ('Funcional 18:00', 'Funcional', 'Palermo',  '2025-09-10', '18:00:00', 20, 'Carlos López', 60),
  ('Yoga 19:00',      'Yoga',      'Belgrano', '2025-09-10', '19:00:00', 15, 'María Pérez',  45),
  ('Spinning 20:00',  'Spinning',  'Palermo',  '2025-09-11', '20:00:00', 25, 'Juan Martínez', 50);

-- Historial (ejemplo)
INSERT INTO history (user_id, class_id, asistencia_fecha) VALUES
  (1, 1, '2025-09-10 18:05:00'),
  (1, 2, '2025-09-11 19:05:00'),
  (1, 3, '2025-09-15 20:05:00');

-- ---------------------------------------------------------
-- Notas:
-- - El backend valida cupo con SELECT ... FOR UPDATE, resta 1 al reservar y suma 1 al cancelar.
-- - También evita superposición de horarios (misma fecha; [hora, hora+duracion)).
-- - Si querés mantener “capacidad total” fija, agregá:
--     ALTER TABLE classes ADD capacidad INT NULL;
--   y usá 'cupo' sólo como disponibles.
-- ---------------------------------------------------------
