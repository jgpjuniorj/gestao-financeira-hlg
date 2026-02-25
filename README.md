
# Gestão Financeira (Node.js) — multi-tenant

Aplicação web para **gestão financeira** que roda no seu domínio, **sem necessidade de planilha**, agora com suporte multi-tenant. Cada **household** (família/empresa) possui seus próprios usuários, seções, categorias e lançamentos isolados.

## Requisitos
- Node.js 20+
- Banco MariaDB 10.6+ (ou MySQL 8 compatível)

## Como executar
1. Baixe/extraia o projeto.
2. Instale dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente (opcional). Exemplo `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=gestao_financeira
   DB_USER=gestao
   DB_PASSWORD=gestao
   SESSION_SECRET=uma-senha-forte-aqui
   ```
   > O app também aceita `AUTH_USERNAME`/`AUTH_PASSWORD` (ou `AUTH_PASSWORD_HASH`) para criar o primeiro usuário.
4. Inicie:
   ```bash
   npm start
   ```
5. Acesse `http://localhost:3000`.

## Uso
- **Dashboard**: visão geral com cards (Renda, Despesas, Resultado), gráfico por seção e tabela.
- **Gerenciar Dados**: cadastre Seções (ex.: RESUMO DO ORÇAMENTO, DESPESAS DE MORADIA), Categorias e Lançamentos mensais.
- **Filtro de período**: na página do Dashboard, escolha `Todos` ou um mês específico.`

## Variáveis importantes
- `AUTH_USERNAME` + `AUTH_PASSWORD`: cria (caso não exista) um usuário administrador durante o boot.
- `DB_CONN_LIMIT`: ajusta o tamanho do pool de conexões MariaDB.
- `SESSION_COOKIE_SECURE`: defina como `true` quando estiver atrás de HTTPS/Proxy que passe `X-Forwarded-Proto`.
- `SESSION_SECRET`: obrigatório em produção para proteger a sessão.

## Estrutura de dados
- `Seções`: agrupam categorias.
- `Categorias`: pertencem a uma seção (ex.: "Aluguel", "Internet", "Salário").
- `Lançamentos`: `{ categoriaId, período (YYYY-MM), orçamento, atual }`.

Os dados ficam em um banco MariaDB configurado via variáveis de ambiente.

## Observações

## Multi-tenant e contas padrão
- Cada tenant (household) possui usuários, seções, categorias e lançamentos isolados por `household_id`.
- Durante o bootstrap são criadas credenciais padrão no primeiro tenant encontrado:
   - Usuário administrador: `junior` / `Skate@123`
   - Usuário padrão: `mariele` / `Mala25direta`
- Em produção, altere as senhas imediatamente na tela `/users`.
- É possível pré-definir outro admin inicial via `AUTH_USERNAME` + `AUTH_PASSWORD` (ou `AUTH_PASSWORD_HASH`).

## Criando e administrando tenants
- Use o script `scripts/create-tenant.js` para provisionar novos ambientes:
   ```bash
   # Defina as credenciais do banco antes de executar
   export DB_HOST=<host-ou-service>
   export DB_PORT=3306
   export DB_NAME=gestao_financeira_hlg
   export DB_USER=gestao_hlg
   export DB_PASSWORD=<senha>

   node scripts/create-tenant.js --name "Financeiro HLG" --slug finan-hlg
   ```
- Em clusters Kubernetes, crie um port-forward temporário (`kubectl port-forward svc/<svc-db> 13306:3306`) ou execute o script dentro de um pod utilitário.
- A interface administrativa `/admin/households` permite renomear, trocar slug e revisar o status de cada tenant.

## Deploy automatizado com Helm
Um chart Helm completo está disponível em `deploy/helm/gestao-financeira`.

### Instalação rápida (MariaDB incluído)
```bash
helm upgrade --install gestao \
   ./deploy/helm/gestao-financeira \
   --namespace gestao-financeira --create-namespace
```

> Se o namespace `gestao-financeira` já existir, acrescente `--set namespace.create=false`.

### Principais overrides
- `image.repository` / `image.tag`: container da aplicação.
- `ingress.hosts[0].host`: domínio a expor.
- `database.credentials.*`: senhas e nomes padrão do MariaDB.
- `database.enabled=false`: desativa MariaDB interno. Nesse caso, informe:
   - `app.database.host`
   - `app.database.port`
   - `app.database.secretName` contendo as chaves `MARIADB_DATABASE`, `MARIADB_USER` e `MARIADB_PASSWORD`.

### Pipeline sugerido pós-modificações
1. Gere uma nova imagem da aplicação (`docker build -t <registry>/gestao-financeira:<tag> .`).
2. Publique a imagem no registry (`docker push <registry>/gestao-financeira:<tag>`).
3. Atualize o release Helm:
   ```bash
   helm upgrade --install gestao \
     ./deploy/helm/gestao-financeira \
     -n gestao-financeira \
     --set namespace.create=false \
     --set image.repository=<registry>/gestao-financeira \
     --set image.tag=<tag>
   ```
4. Verifique o rollout:
   ```bash
   kubectl get pods -n gestao-financeira
   helm status gestao -n gestao-financeira
   ```

   ## Deploy local em kind (sem Git)
   O script `deploy/kind-deploy.sh` automatiza build, load e rollout no cluster kind.

   1. Garanta permissão de execução:
      ```bash
      chmod +x deploy/kind-deploy.sh
      ```
   2. Execute o script:
      ```bash
      ./deploy/kind-deploy.sh
      ```

   Variáveis opcionais:
   - `IMAGE_REPO`: nome da imagem (default `gestao-financeira`).
   - `IMAGE_TAG`: tag a usar (default timestamp).
   - `KIND_CLUSTER`: nome do cluster kind (default `gda-shipping`).
   - `NAMESPACE`: namespace alvo (default `gestao-financeira`).
   - `RELEASE_NAME`: nome do release Helm (default `gestao`).
   - `APP_NAME`: nome completo aplicado ao Deployment (default `gestao-financeira`).
   - `DB_SECRET`: secret já existente com credenciais MariaDB (default `gestao-financeira-db`).
   - `DB_SERVICE`: service do banco existente (default `db-gestao-financeira`).
   - `DB_PORT`: porta do service (default `3306`).

   Exemplo customizado:
   ```bash
   IMAGE_TAG=latest KIND_CLUSTER=gda-shipping APP_NAME=gestao-financeira DB_SECRET=gestao-financeira-db DB_SERVICE=db-gestao-financeira ./deploy/kind-deploy.sh
   ```

Consulte `values.yaml` para todos os parâmetros disponíveis.

## Ambiente gestao-financeira-hlg (produção isolada)
1. Build local (ou pipeline) da imagem: `docker build -t gestao-financeira-hlg:latest .`
2. Carregue no cluster kind de produção: `kind load docker-image gestao-financeira-hlg:latest --name gda-shipping`
3. Faça o rollout Helm com overrides padrão:
    ```bash
    helm upgrade --install gestao-hlg \
       ./deploy/helm/gestao-financeira \
       --namespace gestao-financeira-hlg \
       --create-namespace \
       --set namespace.create=false \
       --set image.repository=gestao-financeira-hlg \
       --set image.tag=latest \
       --set app.env.SESSION_COOKIE_SECURE=false
    ```
4. Crie o tenant `Financeiro HLG` com o script descrito acima (port-forward obrigatório).
5. Atualize a Cloudflare Tunnel (cloudflared) para apontar `finan-hlg.jgpjunior.online` para o service interno:
    ```yaml
    - hostname: finan-hlg.jgpjunior.online
       service: http://gestao-hlg-gestao-financeira.gestao-financeira-hlg.svc.cluster.local:80
    ```
6. Após o rollout, altere as senhas padrão em `/users`.
Consulte `values.yaml` para todos os parâmetros disponíveis.

## Deploy manual (opcional)
- Garanta um banco MariaDB acessível e crie o schema/usuário conforme as variáveis de ambiente.
- Suba o projeto no servidor (ex.: Ubuntu), rode `npm install` e `npm start`.
- Configure um **reverse proxy** (Nginx/Apache) apontando para `localhost:3000` e um **serviço** do sistema (systemd) para iniciar o app na inicialização.
