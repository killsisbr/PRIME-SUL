#!/usr/bin/env python3
"""
Deploy Script para PRIME SUL - VPS
Requer: pip install paramiko
"""

import paramiko
import sys
import os
from pathlib import Path

# Configurações
VPS_HOST = os.getenv('VPS_HOST', '82.29.58.126')
VPS_USER = os.getenv('VPS_USER', 'root')
VPS_PASSWORD = os.getenv('VPS_PASSWORD', 'Killsis19980910#')
VPS_PORT = int(os.getenv('VPS_PORT', '22'))
VPS_APP_DIR = os.getenv('VPS_APP_DIR', '/root/killsis/PRIME-SUL')
VPS_PM2_APP = os.getenv('VPS_PM2_APP', 'prime-sul')

def log(message, type_='info'):
    """Log com cores"""
    colors = {
        'info': '\033[36m',    # Cyan
        'success': '\033[32m', # Green
        'error': '\033[31m',   # Red
        'warning': '\033[33m', # Yellow
        'reset': '\033[0m'
    }
    color = colors.get(type_, colors['info'])
    print(f"{color}{message}{colors['reset']}")

def deploy():
    """Executa o deploy na VPS"""
    
    print("\033[2J\033[H")  # Clear screen
    log('╔════════════════════════════════════╗', 'info')
    log('║  PRIME SUL — Deploy VPS           ║', 'info')
    log('╚════════════════════════════════════╝', 'info')
    
    log(f'\n📍 Host: {VPS_HOST}', 'info')
    log(f'👤 User: {VPS_USER}', 'info')
    log(f'📂 App Dir: {VPS_APP_DIR}', 'info')
    log(f'⚙️  PM2 App: {VPS_PM2_APP}', 'info')
    
    log('\n🚀 Iniciando Deploy...', 'info')
    
    try:
        # Conectar SSH
        log('\n🔐 Conectando na VPS...', 'info')
        
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            client.connect(
                hostname=VPS_HOST,
                port=VPS_PORT,
                username=VPS_USER,
                password=VPS_PASSWORD,
                timeout=30,
                banner_timeout=30
            )
            log('✅ Conectado à VPS', 'success')
        except paramiko.AuthenticationException:
            log('❌ Falha de autenticação', 'error')
            log('Verifique VPS_PASSWORD', 'error')
            sys.exit(1)
        except paramiko.SSHException as e:
            log(f'❌ Erro SSH: {str(e)}', 'error')
            sys.exit(1)
        
        # Comandos a executar
        commands = [
            f'cd {VPS_APP_DIR}',
            'git pull origin staging',
            'npm install --omit=dev',
            f'pm2 restart {VPS_PM2_APP} || pm2 start server/server.js --name {VPS_PM2_APP}',
            'pm2 save',
            f'pm2 status {VPS_PM2_APP}'
        ]
        
        full_command = ' && '.join(commands)
        
        log('\n📂 Executando comandos na VPS...', 'info')
        
        stdin, stdout, stderr = client.exec_command(full_command)
        
        # Mostrar output
        output = stdout.read().decode()
        error = stderr.read().decode()
        
        if output:
            print(output)
        if error:
            print(f'\n⚠️  Warnings/Info:\n{error}')
        
        exit_code = stdout.channel.recv_exit_status()
        
        if exit_code == 0:
            log('\n✅ Deploy completado com sucesso!', 'success')
            log('🎉 Aplicação atualizada na VPS!', 'success')
        else:
            log(f'\n⚠️  Deploy finalizado com código: {exit_code}', 'warning')
        
        client.close()
        
    except Exception as e:
        log(f'\n❌ Erro: {str(e)}', 'error')
        sys.exit(1)

if __name__ == '__main__':
    deploy()
