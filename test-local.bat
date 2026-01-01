@echo off
echo =========================================
echo GO-API - Teste Local com Docker
echo =========================================
echo.
echo Verificando Docker...
docker --version
if errorlevel 1 (
    echo ERRO: Docker nao esta instalado ou nao esta rodando
    pause
    exit /b 1
)
echo.
echo Iniciando containers...
docker-compose -f docker-compose.yml up -d --build
echo.
echo Aguardando inicializacao (30 segundos)...
timeout /t 30 /nobreak
echo.
echo =========================================
echo Servicos disponiveis:
echo - Frontend: http://localhost:3010
echo - API: http://localhost:4000
echo - API Docs: http://localhost:4000/docs
echo =========================================
echo.
echo Para ver logs: docker-compose logs -f
echo Para parar: docker-compose down
pause
