# Liquid Garden

Клиентское `PWA` на `Vite + TypeScript + WebGL` с вязкой жидкостью, декоративными частицами и фоновым изображением с ромашками.

## Локальная разработка

```bash
npm install
npm run dev
```

Для локальной разработки приложение открывается на корне сайта, без специального `base path`.

## Публикация на GitHub Pages

GitHub Pages настроен через workflow [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml).

Что происходит:

- вы разрабатываете приложение локально;
- когда хотите зафиксировать текущий прогресс, делаете `git add`, `git commit` и `git push`;
- каждый push в ветку `main` автоматически собирает проект и публикует `dist` в GitHub Pages;
- для GitHub Pages сборка выполняется с `VITE_BASE_PATH=/relax-liquid/`.

Адрес публикации после включения Pages в настройках репозитория:

`https://ppl636gpt.github.io/relax-liquid/`

## Рекомендуемый рабочий цикл

```bash
git status
git add .
git commit -m "Describe current progress"
git push
```

После push GitHub Actions обновит опубликованную версию проекта.
