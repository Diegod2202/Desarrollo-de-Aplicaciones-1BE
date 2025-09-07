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