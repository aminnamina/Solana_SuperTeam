# SolFlow — Solana Web3 & DS/ML Practice Hub (Devnet)

Учебный и итоговый стартап-проект по курсу **«ИТ-стартап Итоговый проект 1 (DS/ML стартап)»** (AlmaU): смарт-контракты на **Rust и Anchor**, автономный DeFi AMM-пул, 3-уровневый CPI-роутер, лаборатория безопасности (Exploit → Patch), стейблкоин-платежи с **Solana Pay URI** и финальное веб-приложение **SolFlow** с живым RPC-мониторингом и ML-скорингом рисков. Все сетевые сценарии развёрнуты и подтверждены в **Solana Devnet**.

## Технологии
`Rust` · `Anchor 0.30.1` · `Solana Devnet` · `TypeScript` · `Node.js` · `@solana/web3.js` · `@solana/spl-token` · `Metaplex Token Metadata` · `SPL Memo` · `Solana Pay`

## Задеплоенные программы (Solana Devnet)

| Неделя | Программа | Назначение | Program ID |
| :--- | :--- | :--- | :--- |
| **9** | `defi_swap` | Автономный AMM-пул (`x * y = k`, комиссия 0.30%) на SPL Token | [`9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM`](https://explorer.solana.com/address/9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM?cluster=devnet) |
| **11** | `composable_router` | Composable CPI-роутер (`router` → `defi_swap` → `SPL Token` + `SPL Memo`) | [`9t56Ysmdii2T2fk6cnXihjW5Q1k7WCCspD7wsMFQzrB4`](https://explorer.solana.com/address/9t56Ysmdii2T2fk6cnXihjW5Q1k7WCCspD7wsMFQzrB4?cluster=devnet) |
| **12** | `security_vault` | Security Lab: уязвимость Missing Signer Check, exploit и патч | [`CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP`](https://explorer.solana.com/address/CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP?cluster=devnet) |
| **13** | `stablecoin_pay` | Ончейн-инвойсы в `mUSDC`, Solana Pay URI и защита `AlreadyPaid` | [`8xSmfQW68bK4GzSfMk2iELyyVuPzdWEokpBHKCtrYjd9`](https://explorer.solana.com/address/8xSmfQW68bK4GzSfMk2iELyyVuPzdWEokpBHKCtrYjd9?cluster=devnet) |

## Практические работы (Недели 1–15)

| Неделя / Работа | Что реализовано | Статус |
| :--- | :--- | :--- |
| Недели 1–3 — Основы Solana и Rust CLI | Кошелёк, разбор транзакций, аккаунты, инструкции, обработка ошибок | Проверено локально |
| Неделя 4 — Программа Solana на Rust | Точка входа и вывод параметров инструкции | Код подготовлен |
| Неделя 5 — Anchor Counter | Создание и увеличение счётчика | Контракт готов; локальный тест |
| Неделя 6 — PDA-профили | Создание и обновление профиля владельцем | Контракт готов |
| Неделя 7 — SPL Tokens | Mint, ATA, выпуск 1000 AAT, перевод 250 AAT и метаданные Metaplex | Выполнено в Devnet |
| Неделя 8 (РК1) — Profile Rewards | Профиль, репутация и награды через CPI | Собрано; локальные тесты |
| Неделя 9 — DeFi (`defi_swap`) | AMM-пул `x * y = k`, PDA-хранилища `vault_a`/`vault_b` и реальный своп | Задеплоено и проверено в Devnet |
| Неделя 10 — RPC & Blockchain Data | Веб-дашборд: баланс SOL, SPL-токены, резервы пула и история транзакций | Проверено в Devnet |
| Неделя 11 — CPI (`composable_router`) | Атомарный 3-уровневый CPI: `router` → `defi_swap` → `SPL Token` + `SPL Memo` | Задеплоено и проверено в Devnet |
| Неделя 12 — Security & Exploit Lab | Exploit Missing Signer Check → патч `Signer<'info>` → блокировка `AccountNotSigner` | Задеплоено и проверено в Devnet |
| Неделя 13 — Stablecoin Pay | Ончейн-инвойсы в тестовом `mUSDC`, Solana Pay URI, защита `AlreadyPaid (0x1771)` | Задеплоено и проверено в Devnet |
| Недели 14–15 (РК2) — **SolFlow Capstone** | Единый Web3 + DS/ML dApp: Live RPC, AI Risk Score, Live CPI Swap, Stablecoin Pay + QR, Security Audit | Работает в Devnet |

## Подтверждённые результаты в Solana Devnet

- **Кошелёк разработчика:** `F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM`
- **Неделя 7 (AAT Token):** Mint `EpzAym5odoPL4iFEkTKUUsBiCgsi9o7qcngnnZCtEozA` (Sender: `750 AAT`, Receiver: `250 AAT`)
- **Неделя 9 (AMM Swap `-100 A` → `+90.66 B`):** [`GtvqmbqYaqgY...`](https://explorer.solana.com/tx/GtvqmbqYaqgY7mPAye4mRzF6vFH4x3TNqZUoToiyCzhkV2jwUV6wLALXNCREQjRaZGB6KpVFSgTvSE1D4uh47JR?cluster=devnet)
- **Неделя 11 (3-уровневый CPI + SPL Memo):** [`4mYSDhgN6NiL...`](https://explorer.solana.com/tx/4mYSDhgN6NiL7iWGs1qdrZSot7HNLgoaeknKT46D75ZJv2cN7nEKsTboSZxTD2bhGvhSgzwQ214nc6pJ8vT7XzJW?cluster=devnet)
- **Неделя 12 (Security Exploit → Patch):**
  - Успешный exploit до патча (`-5 000 000 lamports` без подписи владельца): [`2ax4tRLgeTza...`](https://explorer.solana.com/tx/2ax4tRLgeTza3vRSuzjCXvcC7Y9SrnbquXXvn3x3Fy3kUemGeYUzVUBfRQeU6Vtty2zW1GgSmcwCyG7jXZXvReES?cluster=devnet)
  - Легитимный вывод после патча (`Signer<'info>`): [`3DvUED45c9xk...`](https://explorer.solana.com/tx/3DvUED45c9xkZqF8vhnQFZsnx2vZqSCHDuxqE8kpXB9KcNeCd2PHDxWceJiUJVvhNx7sYekKfaUxHSeNH38LrNLB?cluster=devnet)
- **Неделя 13 (Stablecoin Pay):** `mUSDC` Mint `BZQCLuDX5y9FW5Fd71LjMpTUNHcvK4P2ASgwgyYYPtN7` · Invoice PDA `2MEURRSLvnSibStvvKciu7RpKMFC7xSJh7FS2pqQgm6e`
- **Недели 14–15 (SolFlow Capstone):**
  - Live CPI Routed Swap: [`4ccn3NJe1UqJ...`](https://explorer.solana.com/tx/4ccn3NJe1UqJ76gQMvMYa5PK26fZPrcdx3LLsaAkPVvcWhgNvFgDJgumGTi3LPFGgWchz4BT54LfmsJ756yKEJKi?cluster=devnet)
  - Live mUSDC Invoice: [`5UFuatjhseYr...`](https://explorer.solana.com/tx/5UFuatjhseYrehTYHfV2u18SBJ1hMbTtx5UVDyqJ9P1cEGRBQjokUirhhfUNEGDiDHX4WKgBynEyu1UzTX6q5UXr?cluster=devnet)

## Структура проекта

```text
programs/
  defi_swap/           # Неделя 9: автономный AMM-пул (x * y = k)
  composable_router/   # Неделя 11: CPI-роутер (defi_swap + SPL Memo)
  security_vault/      # Неделя 12: Security & Exploit Lab (patched)
  stablecoin_pay/      # Неделя 13: стейблкоин-инвойсы и Solana Pay
  profile_rewards/     # Неделя 8: on-chain профиль и награды
  profile/             # Неделя 6: PDA-профили
  counter/             # Неделя 5: Anchor Counter
tests/
  defi_swap.ts                 # Интеграционный тест AMM-пула
  composable_router.ts         # Тест 3-уровневого CPI и on-chain логов
  security_vault_exploit.ts    # Тест exploit (vulnerable / patched)
  stablecoin_pay.ts            # Тест инвойсов, Solana Pay и AlreadyPaid
  spl-token.ts                 # Интеграционный тест Недели 7
  mvp.ts                       # Интеграционный тест Недели 8
dashboard/                     # Неделя 10: Live Devnet RPC Dashboard
capstone/                      # Недели 14–15: SolFlow AI DeFi & Stablecoin Pay Hub
docs/                          # Отчёты по Неделям 9–15 и план Demo Day

## Week 11: Концентрированная ликвидность (Raydium CLMM в Devnet)

### 1. Отличие CLMM от классического AMM ($x \cdot y = k$), роль тиков и NFT-позиции

- **Классический AMM ($x \cdot y = k$):** Ликвидность распределяется равномерно по всей бесконечной кривой цен от $0$ до $+\infty$. В результате подавляющая часть предоставленного капитала простаивает вне текущего торгового диапазона, приводя к низкой эффективности капитала (capital inefficiency) и высокому проскальзыванию (slippage) при крупных сделках.
- **CLMM (Concentrated Liquidity Market Maker):** Ликвидность концентрируется внутри заданного поставщиком диапазона цен $[P_{\min}, P_{\max}]$. Капитал используется в десятки и сотни раз эффективнее, принося более высокие комиссии на единицу вложенных средств при нахождении цены внутри интервала.
- **Тики (Ticks) и Tick Spacing:** Ценовое пространство разбито на дискретные точки — тики, где цена на тике $i$ задаётся соотношением $P(i) = 1.0001^i$. Торговля и пересчёт ликвидности происходят дискретно по тикам с шагом `tickSpacing` (в данном пуле 60 тиков на шаг).
- **NFT-позиция (Non-Fungible Position):** В классическом AMM поставщик получает взаимозаменяемые LP-токены (SPL Fungible Tokens), так как условия для всех провайдеров идентичны. В CLMM каждая позиция уникальна (индивидуальный диапазон $[tick_{\min}, tick_{\max}]$, объём ликвидности, накопленные комиссии), поэтому право собственности на позицию и её параметры оборачиваются в отдельный SPL NFT.

### 2. Команды для воспроизведения (`clmm-tools/`)

В директории `clmm-tools/` реализован CLI-инструментарий на TypeScript для взаимодействия с Raydium CLMM:

- `npm run mint` — создание котируемого токена `mUSDC`, проверка/подключение базового токена и минт по 100 000 единиц каждого на ATA кошелька.
- `npm run pool` — инициализация CLMM-пула в Raydium с тиром комиссии 0.25% (`tickSpacing: 60`) и стартовой ценой.
- `npm run lp` — расчёт тиков и открытие концентрированной NFT-позиции в асимметричном диапазоне.
- `npm run inspect` — считывание ончейн-состояния пула (текущая цена, активный тик, суммарная ликвидность) и параметров открытой NFT-позиции.

### 3. Ончейн-артефакты в Solana Devnet (Explorer)

Все транзакции и аккаунты подтверждены в **Solana Devnet** (из `clmm-tools/devnet-state.json`):

- **Базовый токен (Base Mint):** [`6frqPxC5jtzSk1P3eS6xqFvTq6yY5b2ujDwtw5w2g6A1`](https://explorer.solana.com/address/6frqPxC5jtzSk1P3eS6xqFvTq6yY5b2ujDwtw5w2g6A1?cluster=devnet)
- **Котируемый токен (Quote Mint / mUSDC):** [`B4EyXuMSht7WSreK4zzazUf7rLsSULSvBX2XuCbxnvy`](https://explorer.solana.com/address/B4EyXuMSht7WSreK4zzazUf7rLsSULSvBX2XuCbxnvy?cluster=devnet)
- **CLMM Пул (Pool ID):** [`GBbcu5ic5HRWaWqF5kwurkoE4xmEWCiujUGXK4CgfzHY`](https://explorer.solana.com/address/GBbcu5ic5HRWaWqF5kwurkoE4xmEWCiujUGXK4CgfzHY?cluster=devnet)
- **Транзакция создания пула:** [`5dLyiwffWSwUFH7Bi6TD1ZguwAGvLp66uBPSA75CBZY4zTLENFp5svS98Vg8FJR7jNzZgaSY2Qk4yn2ysFHZPsTg`](https://explorer.solana.com/tx/5dLyiwffWSwUFH7Bi6TD1ZguwAGvLp66uBPSA75CBZY4zTLENFp5svS98Vg8FJR7jNzZgaSY2Qk4yn2ysFHZPsTg?cluster=devnet)
- **NFT Mint открытой позиции:** [`3eP9acZtNW6vyFgWW2rLpBqSKD7ZLnbfr7hjdfqqDhD3`](https://explorer.solana.com/address/3eP9acZtNW6vyFgWW2rLpBqSKD7ZLnbfr7hjdfqqDhD3?cluster=devnet)
- **Транзакция открытия LP-позиции:** [`4cFYVgkhwx2hAfwWYqc8xwoVrXfv362JpmvRofcPKGQFLAFfGh6kQX25cFG61iNzKasEs6vLh9pEpPE4QBpwsWe8`](https://explorer.solana.com/tx/4cFYVgkhwx2hAfwWYqc8xwoVrXfv362JpmvRofcPKGQFLAFfGh6kQX25cFG61iNzKasEs6vLh9pEpPE4QBpwsWe8?cluster=devnet)

### 4. Обоснование асимметричного диапазона (-15% / +25%)

Выбор асимметричного ценового коридора $[-15\%, +25\%]$ (`priceLower: 0.212500`, `priceUpper: 0.312500`, тики `[-15540, -11640]`):
- **Учёт бычьего тренда (Bullish Skew):** Для развивающихся токенов экосистемы восходящая волатильность обычно превосходит нисходящую. Расширенный верхний предел ($+25\%$) позволяет позиции оставаться активной и генерировать торговые комиссии при росте курса токена без преждевременного полного выхода в котируемый стейблкоин.
- **Ограничение риска просадки (Downside Protection):** Сужение нижнего диапазона до $-15\%$ минимизирует риск глубоких непостоянных потерь (impermanent loss) и предотвращает накопление обесценивающегося актива при резком дампе: при падении ниже $0.2125$ позиция полностью переходит в базовый актив, фиксируя границу убытка от продолжения падения внутри пула.
- **Оптимизация плотности капитала:** Сжатие диапазона до 40% ширины (вместо бесконечного $[0, \infty]$) повышает плотность ликвидности и объём генерируемых протокольных комиссий более чем в 5 раз по сравнению со стандартным пулом $x \cdot y = k$.

## Week 12: CPI-своп через Raydium CLMM и защита от slippage

### 1. Архитектура ончейн-аккаунтов: `SwapRoute` и `quote_treasury`

- **Аккаунт `SwapRoute` (PDA `[b"swap_route", vault.key()]`):**
  Хранит связку между конкретным хранилищем `Vault`, авторизованным пулом Raydium CLMM `pool_state`, котируемым минтом `quote_mint` и казначейским токен-аккаунтом `quote_treasury`.
  *Зачем вынесен в отдельный PDA?*
  Вынесение маршрута обмена в отдельный изолированный PDA-аккаунт отделяет базовое состояние хранилища (`Vault`: права администратора, базовый баланс) от изменяемой DeFi-инфраструктуры. Это позволяет безопасно перенастраивать или обновлять торговый маршрут (например, при смене пула Raydium или переходе на другой тир комиссии) без риска изменения прав доступа к самому Vault.
- **Токен-аккаунт `quote_treasury` (PDA `[b"quote_treasury", vault.key()]`):**
  Ончейн-хранилище котируемых токенов (`mUSDC`), где владельцем (`authority`) назначен сам `Vault` PDA. Программа инициализирует его через Anchor-макрос `token::authority = vault`, что гарантирует невозможность прямого вывода средств в обход логики смарт-контракта хранилища.

### 2. Инструкции контракта: `configure_swap_route` и `execute_clmm_swap`

- **`configure_swap_route`:**
  - Доступна исключительно администратору хранилища (`has_one = authority`).
  - Валидирует аккаунт пула: проверяет, что его владельцем выступает программа Raydium CLMM (`DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH`).
  - Парсит срез данных пула (`mintA` и `mintB`) и проверяет, что они строго соответствуют паре `(vault_mint, quote_mint)` в любом порядке (иначе ошибка `InvalidPoolMints`).
  - Фиксирует конфигурацию в аккаунте `SwapRoute` и автоматически инициализирует казначейство `quote_treasury`.
- **`execute_clmm_swap`:**
  - Доступна только администратору (`has_one = authority`).
  - Принимает параметры `SwapParams { direction, amount_in, min_amount_out }`.
  - Проверяет `amount_in > 0` (`ZeroSwapAmount`) и соответствие переданного пула зарегистрированному `swap_route.pool_state` (`UnauthorizedPool`).
  - На основе `SwapDirection` (`BaseToQuote` или `QuoteToBase`) определяет входящие и исходящие токен-аккаунты, минты и резервуары пула (`vaultA` / `vaultB`).
  - Формирует межпрограммный вызов (CPI) к инструкции `swap_v2` в Raydium CLMM с 8-байтным дискриминатором `[43, 4, 237, 11, 26, 201, 30, 98]`.
  - Подписывает вызов PDA-сидами хранилища (`[b"vault", authority.key(), &[bump]]`), передавая `remaining_accounts` (bitmap extension и актуальные tick arrays).
  - Эмитит ончейн-событие `ClmmSwapExecuted`.

### 3. Ончейн-артефакты и транзакции в Solana Devnet

- **Программа Vault (Security Vault):** [`CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP`](https://explorer.solana.com/address/CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP?cluster=devnet)
- **Аккаунт Vault PDA:** [`7Bc2iVWad9gdcsa6KwMYH2gj4VK5KhNbnDwCzX4BCWDR`](https://explorer.solana.com/address/7Bc2iVWad9gdcsa6KwMYH2gj4VK5KhNbnDwCzX4BCWDR?cluster=devnet)
- **Маршрут SwapRoute PDA:** [`6qAb2MhgrY9cSFSMki36bz3vAYWs4pNMToBdJwAxBBFW`](https://explorer.solana.com/address/6qAb2MhgrY9cSFSMki36bz3vAYWs4pNMToBdJwAxBBFW?cluster=devnet)
- **Quote Treasury PDA:** [`Dk1Xwbmq7gDArxtrC6NPjqRYqbaFMLFUPaMSx4gfuMrK`](https://explorer.solana.com/address/Dk1Xwbmq7gDArxtrC6NPjqRYqbaFMLFUPaMSx4gfuMrK?cluster=devnet)
- **Base Treasury ATA:** [`G94UboyVwtgYUEa6t3PW65D4X3z5y68v5Sdo3cFaEzZm`](https://explorer.solana.com/address/G94UboyVwtgYUEa6t3PW65D4X3z5y68v5Sdo3cFaEzZm?cluster=devnet)
- **Транзакция настройки маршрута (`configure_swap_route`):** [`3NL1siW36E4ZQXbfa5zvoQU7Qz5Y8m4trhvYu2jfHsXfjFWFoZ79ED6vzwgSGbFmQMkaV8gUdmsuGuxRJfgcsJFN`](https://explorer.solana.com/tx/3NL1siW36E4ZQXbfa5zvoQU7Qz5Y8m4trhvYu2jfHsXfjFWFoZ79ED6vzwgSGbFmQMkaV8gUdmsuGuxRJfgcsJFN?cluster=devnet)
- **Транзакция успешного свопа (150 Base -> Quote):** [`iHxPchUUWRrcQMAo1geawRCC8eXdF8Cvf2yzVS42XdfeZtwpN7JhXMoqqwCimcmENG9pq9bWw7fBonn365h2g63`](https://explorer.solana.com/tx/iHxPchUUWRrcQMAo1geawRCC8eXdF8Cvf2yzVS42XdfeZtwpN7JhXMoqqwCimcmENG9pq9bWw7fBonn365h2g63?cluster=devnet)
- **Транзакция отклонённого свопа по slippage protection:** Симулирована и отклонена в ончейн-рантайме с ошибкой Raydium CLMM `TooLittleOutputReceived (0x1782 / 6018)` (Left: `193,764,725`, Right: `290,647,087`). Балансы хранилища не изменились.

### 4. Динамика цены и балансов хранилища

| Метрика | До свопа | После свопа | Изменение ($\Delta$) |
| :--- | :--- | :--- | :--- |
| **Баланс Base (Vault)** | `2000.0` | `1850.0` | **-150.0** Base |
| **Баланс Quote (Vault)** | `0.0` | `591.055821` | **+591.055821** mUSDC |
| **Индикативная цена пула** | `0.250000` | `0.256337` | **+2.53%** (Price Impact) |

*Анализ комиссии и влияния на цену:*
- Обмен объёмом 150 базовых токенов сместил текущую цену пула вверх на $+2.53\%$ из-за ограниченной глубины ликвидности в текущем тике.
- Протокол Raydium автоматически удержал комиссию пула $0.25\%$, направив чистый объём котируемого токена в `quote_treasury`.

### 5. Ответы на контрольные вопросы

1. **Что такое slippage и как работает `min_amount_out`?**
   *Проскальзывание (slippage)* — это разница между ожидаемой ценой сделки в момент отправки транзакции и её фактической ценой исполнения на момент включения в блок валидатором. Причиной могут быть параллельные свопы других участников или движение цены по кривой ликвидности. Параметр `min_amount_out` задаёт строгий минимальный порог токенов, который контракт обязан получить на выходе. Если расчётная сумма хотя бы на 1 наименьшую долю токена меньше порога, программа немедленно прерывает транзакцию (revert) с ошибкой `TooLittleOutputReceived`, сохраняя балансы пользователей нетронутыми.
2. **Почему при низкой ликвидности рядом с текущей ценой price impact выше?**
   В CLMM цена меняется при исчерпании ликвидности текущих тиков. Когда объём доступных токенов в активном ценовом интервале невелик, крупный ордер быстро поглощает всю локальную глубину стакана и вынуждает цену перешагивать через несколько тиков (`tick transitions`) в поисках следующей ликвидности. Чем меньше сконцентрировано средств около спотовой цены, тем круче локальный угол наклона ценовой кривой и тем сильнее сдвигается цена исполнения от одной и той же суммы сделки.
3. **Зачем в CPI подписывает именно `Vault` PDA, а не кошелёк админа?**
   Токены хранилища принадлежат самому смарт-контракту и депонированы на токен-аккаунтах, чьим полноправным владельцем (`owner/authority`) является PDA `[b"vault", authority]`. Кошелёк администратора не владеет этими токенами напрямую в SPL Token программе. При выполнении свопа Raydium списывает токены с баланса хранилища, поэтому авторизовать списание может исключительно сам `Vault` через механизм PDA-подписи `invoke_signed`. Это реализует принцип наименьших привилегий (Principle of Least Privilege): админ управляет процессом, но технически переместить средства может только контракт строго в соответствии с заложенными правилами проверки маршрута и слиппеджа.

