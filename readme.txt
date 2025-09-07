🔐 Autenticación (Punto 1)

POST /auth/request-otp → recibe un email, genera un código, lo envía por mail.

POST /auth/verify-otp → recibe email + otp, valida, genera JWT y devuelve usuario.

👤 Perfil (Punto 2)

GET /users/me → devuelve datos del perfil (necesita token).

PUT /users/me → editar nombre, foto opcional.

📅 Catálogo de Clases (Punto 4)

GET /classes → lista de clases con filtros (sede, disciplina, fecha).

GET /classes/:id → detalle de una clase.

📌 Reservas (Punto 5)

POST /reservations → crear reserva (valida cupo).

DELETE /reservations/:id → cancelar.

GET /reservations/me → ver próximas reservas.

📖 Historial (Punto 8)

GET /history → devuelve asistencias pasadas, con filtro de fechas.