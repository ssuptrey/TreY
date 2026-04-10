with open('authService.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'INSERT INTO users' in line:
        new_lines.append("        INSERT INTO users (email, password_hash, name, role, organization_id) VALUES (, , , , ) RETURNING id, email, name, role, organization_id, created_at,\n")
    elif 'SELECT u.*, o.name as organization' in line:
        new_lines.append("      SELECT u.*, o.name as organization_name, o.type as organization_type FROM users u JOIN organizations o ON u.organization_id = o.id WHERE u.email = ,\n")
    elif 'SELECT increment_failed_login' in line:
        new_lines.append("      await pool.query(SELECT increment_failed_login() WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_failed_login'), [user.id]);\n")
    elif 'SELECT reset_failed_login' in line:
        new_lines.append("    await pool.query(SELECT reset_failed_login() WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_failed_login'), [user.id]);\n")
    else:
        new_lines.append(line)

with open('authService.ts', 'w') as f:
    f.writelines(new_lines)
