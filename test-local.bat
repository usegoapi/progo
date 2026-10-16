@echo off
echo =========================================
echo GO-API - Teste Local com Docker
echo =========================================
echo.
docker --version
if errorlevel 1 (
    echo ERRO: Docker nao esta instalado ou nao esta rodando
    pause
    exit /b 1
)
if not exist .env (
    echo ERRO: arquivo .env nao encontrado. Copie .env.example para .env e preencha os segredos.
    pause
    exit /b 1
)
echo.
echo Construindo e iniciando containers...
docker compose up -d --build
echo.
echo =========================================
echo Servicos:
echo - Painel: http://localhost:3010
echo - API:    http://localhost:4000
echo - Saude:  http://localhost:4000/health
echo =========================================
echo.
echo Logs:  docker compose logs -f api
echo Parar: docker compose down
pause
