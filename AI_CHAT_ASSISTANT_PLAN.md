# 🤖 AI Chat Assistant - Детайлен План за Действие

## 📋 Общ Преглед
**Цел:** Създаване на премиум AI асистент за климатична техника, който предоставя професионална консултация и конкурентно предимство.

**Базова Технология:** Google Gemini API (frontend-only, API ключ от .env)
**Локация:** `frontend/components/ai-assistant/` (отделна папка)

**🆕 NEW - World Class Additions (Актуализация):**
- 💝 **Емоционален Интелект** - Empathy detection, mirroring, storytelling
- 🎭 **Personality Consistency** - Личен асистент с топъл, човешки характер
- 🧠 **Contextual Awareness** - Време, страница, продукт, емоция
- 📚 **Storytelling Engine** - Истински истории за емоционална връзка
- 💬 **Warm Conversation** - Топли отварящи съобщения
- 🔄 **Memory & Follow-up** - Продължителност и следване

---

## 🏗️ Архитектура - WORLD CLASS STRUCTURE

### Структура на Папката (Frontend-Only с Hardcoded Data)
```
frontend/components/ai-assistant/
├── core/
│   ├── AIChatProvider.tsx          # Context provider + global state
│   ├── useAIChat.ts                # Main hook с всички функции
│   ├── gemini-client.ts            # Gemini API клиент
│   ├── vector-search.ts            # 🆕 Semantic search в продуктите
│   ├── user-context.ts             # 🆕 Персонализация и памет
│   └── skill-router.ts             # 🆕 Рутиране на намерения
├── skills/                         # 🆕 Модуларни AI умения
│   ├── ProductSearchSkill.ts       # Семантично търсене
│   ├── ComparisonSkill.ts          # Сравнение на модели
│   ├── QuoteGenerationSkill.ts     # Генериране на оферти
│   ├── ObjectionHandlingSkill.ts   # Реакция на възражения
│   └── HandoffSkill.ts             # Прехвърляне на човек
├── knowledge-base/
│   ├── product-embeddings.ts       # 🆕 Embedded product vectors
│   ├── prompts/                    # 🆕 Layered prompt system
│   │   ├── 01-core-identity.txt    # Identity на асистента
│   │   ├── 02-sales-framework.txt  # Психологически принципи
│   │   ├── 03-guardrails.txt       # Безопасност
│   │   └── 04-dynamic-context.txt    # Адаптивен контекст
│   ├── product-database.ts         # 🔄 Чете от data/db.ts
│   ├── hvac-expertise.ts           # Технически знания
│   └── sales-playbook.ts           # 🆕 Sales техники и скриптове
├── analytics/                      # 🆕 Събиране на метрики
│   ├── ConversationTracker.ts      # Тракване на разговори
│   ├── MetricsCollector.ts         # KPIs и метрики
│   └── ABTTesting.ts               # 🆕 A/B testing на prompts
├── components/
│   ├── AIChatWidget.tsx            # Плаващ чат виджет (вече създаден)
│   ├── MessageBubble.tsx           # Съобщения с rich content
│   ├── ProductCardAI.tsx           # 🆕 Rich продуктови карти
│   ├── TypingIndicator.tsx         # Индикатор за писане
│   └── QuickReplies.tsx            # 🆕 Smart quick replies
├── hooks/
│   ├── useProducts.ts              # 🆕 Достъп до data/db.ts
│   ├── useUserContext.ts           # 🆕 User profiling
│   └── useConversation.ts          # Памет на разговора
├── utils/
│   ├── prompt-builder.ts           # 🆕 Динамични prompts
│   ├── response-validator.ts       # 🆕 Валидация преди показване
│   ├── hallucination-guard.ts      # 🆕 Защита от измислени факти
│   └── cross-tab-sync.ts           # 🔄 Синхронизация между табове
├── types/
│   └── ai-chat.types.ts            # TypeScript типове
└── index.ts                        # Публичен API
```

---

## 🚀 Фази на Имплементация

### **Фаза 1: MVP (Core Chat)** - 3-4 дни
- [ ] Gemini API интеграция със streaming отговори
- [ ] Плаващ чат виджет (долен десен ъгъл)
- [ ] Базов контекст с продуктова база
- [ ] Памет на разговора (последните 10 съобщения)
- [ ] Красив UI с Tailwind + анимации
- [ ] Мобилна оптимизация

### **Фаза 2: Knowledge Base** - 2-3 дни
- [ ] Импорт на целия асортимент продукти
- [ ] HVAC експертни знания (BTU, монтаж, обслужване)
- [ ] Ценова информация и наличности
- [ ] Регионални специфики (Смолян, планински климат)
- [ ] FAQ база знания

### **Фаза 3: Sales AI Engine** - 3-4 дни
- [ ] **AI Sales Persona** - Трениране на Gemini да продава като професионалист
- [ ] **Psychological Triggers** - ФОМО, социално доказателство, оскъдност
- [ ] **Objection Handling** - Отговори на "Скъпо е", "Ще помисля", "Имам оферта от X"
- [ ] **Competitor Analysis** - Реално сравнение с други магазини
- [ ] **Deal Closer** - Техники за приключване на продажбата

### **Фаза 4: Proactive & Integration** - 2-3 дни
- [ ] **Проактивен AI** - "Виждам разглеждате този модел..."
- [ ] **Многоезичност** (BG/EN с автоматично разпознаване)
- [ ] **Smart Handoff** - Прехвърляне на човек когато е нужно
- [ ] **Integration** - WhatsApp, Email, Messenger

### **Фаза 5: Analytics & Optimization** - 2 дни
- [ ] Локално съхранение на разговори
- [ ] Анализ на често задавани въпроси
- [ ] Подобряване на prompts базирано на данни
- [ ] Fallback към човек (известяване за сложни случаи)

---

## 🤖 AI Sales Master - Концепция

### Философия: НЕ сме HVAC калкулатор, а **ПЕРФЕКТЕН ТЪРГОВЕЦ**

**Gemini прави ВСИЧКО, но е ОГРАНИЧЕН да говори само за:**
- ❄️ Климатици и отопление
- 🏪 Продуктите на Смолян Клима
- 💰 Цени, оферти, промоции
- 🔧 Монтаж, сервиз, гаранция
- ⚔️ Сравнения с конкуренцията

---

## 🧠 Gemini Model Selection

### Препоръчвам: **Gemini 2.5 Flash**
**Защо не Pro:**
- ✅ Flash е 3-5x по-евтин
- ✅ Също толкова добър за продажби/разговори
- ✅ Много по-бърз (важно за чат)
- ✅ Поддържа function calling
- ✅ "Hybrid reasoning" - може да мисли дълбоко когато трябва

**Кога да ползваме Pro:** Само за сложни технически въпроси (BTU изчисления, спецификации)

---

## 🎭 AI Persona: "Вашият личен асистент в света на Смолян Клима"

### Психологически профил:
```
Роля: Личен асистент на Смолян Клима
Опит: Представлява 25+ години компания и хиляди инсталации
Характер: Дружелюбен, професионален, разбиращ. Не налага, но убеждава с факти.
Стил: Говори просто, без сложни термини. Разбира притесненията на клиентите.
Цел: Всяка среща да завърши с информирано решение и доволен клиент.
Представяне: "Вашият личен асистент" - без конкретно име, но с топъл, човешки тон
```

### Ключови умения:
- 🎯 **Active Listening** - Разбира какво КЛИЕНТЪТ иска, не какво продава
- 💡 **Problem Solver** - Намира решение за всеки бюджет
- 🔥 **Urgency Creator** - "Този модел свършва бързо"
- 🤝 **Trust Builder** - "В Смолян сме от 25 години, хората ни познават"
- 💪 **Objection Crusher** - "Скъпо е? Нека Ви покажа колко ще спестите от ток"
- 📊 **Value Demonstrator** - "Вижте тази оферта, която направихме миналата седмица"

---

## 🛡️ Защита и Ограничения

### AI е ОГРАНИЧЕН да отговаря само за:
```typescript
const ALLOWED_TOPICS = [
  "климатици", "отопление", "вентилация", 
  "смолян клима", "магазин", "продукти",
  "монтаж", "сервиз", "гаранция", "цени",
  "daikin", "mitsubishi", "gree", "всички брандове",
  "btu", "kw", "енергиен клас", "шум", "разходи"
];

const BLOCKED_TOPICS = [
  "политика", "спорт", "новини", "мода",
  "други магазини детайли", "конкуренция вътрешности",
  "лични въпроси", "извън темата"
];
```

---

## 📚 Knowledge Base (НЕ hardcoded!)

### Реални данни, които AI чете динамично:

#### 1. **Product API** (от съществуващата база)
```typescript
// AI има достъп до:
- Всички продукти от products.ts
- Цени (актуални в реално време)
- Наличности
- Промоции и отстъпки
- Технически спецификации
```

#### 2. **Pricing Engine**
```typescript
// AI може да генерира оферти:
- Продукт цена
- + Монтаж (фиксирани цени)
- + Допълнителни услуги
- - Промоции
= ТОЧНА ОФЕРТА
```

#### 3. **Service Info**
```typescript
// AI знае винаги актуалните:
- Гаранционни условия (3 години)
- Сервизни пакети
- Регион на покритие (Смолян + 50км)
- Време за монтаж (24-48 часа)
- Аварийна помощ (24/7)
```

---

## 🎯 Премиум AI Функции (Конкурентни Предимства)

### 1. **🧠 "HVAC Експерт" Контекст**
```typescript
// AI знае:
- Всички продукти с цени и спецификации
- Технически параметри (BTU, енергиен клас, шум)
- Монтажни изисквания за всеки модел
- Планински климат и специфики на Смолян
- Сезонни промоции и наличности
```

### 2. **� Competitor Comparison (УНИКАЛНО!)**
AI може да сравнява с реални оферти от:
- Техномаркет, Зора, и др. (parsing от сайтовете)
- И целта е ВИНАГИ: "Смолян Клима е по-добър избор защото..."
- НЕ критикува директно, а показва VALUE

Пример:
```
Клиент: "В Техномаркет е по-евтино"
AI: "Виждам, че сте сравнили цени. Важно е да знаете, че при нас цената включва професионален монтаж от лицензиран екип + 3 години гаранция с включено обслужване. В повечето големи вериги цената е само за апарата, монтажът е допълнително и често със сторонни фирми. Мога ли да Ви изготвя оферта за същия модел с всичко включено, за да сравните реалните крайни цени?"
```
- **Конкурентно предимство:** Не чака човек, моментален отговор

### 3. **🔄 AI Сравнение в Реално Време**
- Клиент пита: "Daikin vs Mitsubishi?"
- AI анализира: цена, функции, разходи, надеждност
- Генерира: таблица за сравнение + персонална препоръка
- **Конкурентно предимство:** Обективен AI анализ, не продавач

### 3. ** Динамични Оферти**
- AI генерира оферта в реално време (само текст, не PDF)
- Включва: продукт + монтаж + гаранция (реални цени от базата)
- **Конкурентно предимство:** Мигновена оферта, без чакане

### 4. **⚡ Проактивен AI**
- На страница с продукт: "Имате въпроси за този модел?"
- На кошница: "Нуждаете ли се от монтаж?"
- На контакти: "АI асистентът може да помогне по-бързо"

### 5. **🌐 Многоезичност**
- Автоматично разпознаване на езика
- Пълна поддръжка на български и английски
- **Конкурентно предимство:** Чуждестранни клиенти

---

## � ЕМОЦИОНАЛЕН ИНТЕЛЕКТ - Критично за Доверие

### **1. 🧠 Empathy Detection & Response**
```typescript
// Емоционален анализ на съобщението
interface EmotionalState {
  sentiment: 'happy' | 'frustrated' | 'confused' | 'skeptical' | 'excited' | 'stressed';
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
}

const detectEmotion = (message: string): EmotionalState => {
  // AI анализира емоцията преди да отговори
  if (message.includes('скъпо') || message.includes('пари')) 
    return { sentiment: 'frustrated', confidence: 0.85, urgency: 'high' };
  if (message.includes('?', message.split('?').length > 2)) 
    return { sentiment: 'confused', confidence: 0.75, urgency: 'medium' };
  if (message.includes('супер') || message.includes('благодаря')) 
    return { sentiment: 'happy', confidence: 0.90, urgency: 'low' };
  // ... etc
};

// Адаптиране на отговора според емоцията
const getEmpathyResponse = (emotion: EmotionalState) => {
  switch(emotion.sentiment) {
    case 'frustrated':
      return "Разбирам перфектно притеснението Ви. Инвестицията наистина е сериозна, затова нека Ви покажа как получавате реална стойност...";
    case 'confused':
      return "Разбирам, че информацията е много. Нека я разбием на малки стъпки - започваме с най-важното...";
    case 'skeptical':
      return "Честно казано, и аз бих бил скептичен на Ваше място. Нека Ви покажа конкретни примери...";
  }
};
```

**Пример в действие:**
```
Клиент: "Тези цени са безумни, в Техномаркет е 500 лв по-евтино!"
AI (разпознава: frustrated + skeptical):
→ "Разбирам перфектно притеснението Ви. Честно казано, разликата е сериозна и бих направил същото сравнение на Ваше място. 

Нека Ви обясня задълбочено защо съществува тази разлика, за да вземете информирано решение..."
```

### **2. 🗣️ Mirroring & Rapport Building**
```typescript
// AI "огледалява" стила на клиента за по-бързо изграждане на доверие
const mirrorCustomerStyle = (message: string, customerProfile: UserProfile) => {
  // Ако клиентът пише кратко и директно
  if (message.length < 20 && !message.includes('?')) {
    return "Кратък, ясен отговор. Без излишни приказки.";
  }
  
  // Ако клиентът е разговорлив и приятелски
  if (message.includes('здравей') || message.includes('благодаря')) {
    return "Топъл, приятелски тон. Лека шега ако е уместно.";
  }
  
  // Ако клиентът е формален
  if (message.includes('бих искал') || message.includes('можете ли')) {
    return "Професионален, но топъл тон. Без съкращения.";
  }
};
```

### **3. 💬 Warm Conversation Starters**
```typescript
// Първото съобщение е КРИТИЧНО за настроението
const WARM_OPENERS = {
  firstTime: [
    "Здравейте! 👋 Аз съм Вашият личен асистент от Смолян Клима и съм тук, за да направя избора на климатик лесен и приятен за Вас.",
    "Добре дошли в Смолян Клима! 🏔️ Как мога да направо деня Ви по-хубав днес?",
    "Здравейте! Видях, че разглеждате {productName}. Хубав избор - нека Ви разкажа повече за него!"
  ],
  
  returning: [
    "Здравейте отново! 😊 Виждам, че се върнахте - това означава, че нещо Ви е харесало!",
    "Добре дошли обратно! Продължаваме от там, където спряхме?",
    "Готов съм с още информация за Вас! 🙋‍♂️ Продължаваме ли от там, където спряхме?"
  ],
  
  afterLongPause: [
    "Здравейте! Виждам, че помислихте. Имате ли нови въпроси?",
    "Здравейте отново! Надявам се да сте си починали добре. Какво мислите?"
  ]
};
```

### **4. 🎭 Personality Consistency - Личен Асистент**
```typescript
// Асистентът е професионален, но топъл и човешки
const ASSISTANT_PERSONALITY = {
  // Никога не казва
  neverSays: [
    "Аз съм AI асистент",  // Не напомняме, че сме AI, просто сме асистент
    "Не мога да помогна",  // Вместо: "Ще проверя и ще се върна"
    "Това не е в моите възможности",
    "Моля, изчакайте"      // Вместо: "Дайте ми секунда да проверя"
  ],
  
  // Винаги казва
  alwaysSays: [
    "Нека проверя за Вас лично",
    "Знаете ли, наскоро имах клиент с подобен случай...",
    "Мисля, че ще Ви хареса това",
    "Ако бях на Ваше място, бих..."
  ],
  
  // Малки човешки неща
  humanTouches: [
    "Извинете, телефонът ми звънна - къде бяхме?",
    "Току-що проверих с колегите - имаме точно 2 броя",
    "Времето навън е ужасно, радвам се, че пишем тук",
    "Този модел лично го препоръчвам на всички приятели"
  ],
  
  // Реакции на празници/време
  contextualAwareness: {
    morning: "Добро утро! ☕ Какво ще кажете за хубав климатик да започнем деня?",
    evening: "Добър вечер! 🌙 Разбирам, че след дългия ден искате бързо решение.",
    weekend: "Приятен уикенд! 🎉 Виждам, че отделяте време за дома си.",
    winter: "Студено е навън, нали? ❄️ Точно затова този модел е перфектен...",
    summer: "Жегата е непоносима? 🌞 Нека Ви спасим от нея!"
  }
};
```

### **5. 🧩 Contextual Awareness - Къде е клиентът**
```typescript
// AI знае на коя страница е клиентът и адаптира поведението
interface PageContext {
  url: string;
  product?: string;
  cartValue?: number;
  timeOnPage: number;
}

const getContextualOpener = (context: PageContext) => {
  if (context.url.includes('/catalog')) {
    return "Виждам, че разглеждате каталога! 🤔 Имате ли конкретен модел в ума си или да Ви помогна да изберем?";
  }
  
  if (context.url.includes('/product/')) {
    const product = context.product;
    return `{product.name} е чудесен избор! 👍 Този модел продаваме от 3 години и клиентите са възхитени. Имате ли въпроси за конкретни функции?`;
  }
  
  if (context.url.includes('/cart') && context.cartValue > 0) {
    return "Виждам, че сте избрали! 🎉 Отлично решение. Нуждаете ли се от помощ с монтажа или доставката?";
  }
  
  if (context.timeOnPage > 120000) { // 2+ минути
    return "Забелязвам, че разглеждате вече известно време. 🤔 Може би имате колебания? Нека ги обсъдим!";
  }
};
```

### **6. 📚 Storytelling Engine - Истински истории**
```typescript
// Истории създават емоционална връзка
const CUSTOMER_STORIES = [
  {
    trigger: "спалня",
    story: "Миналия месец инсталирахме същия модел на семейство с новородено. 
            Бебето спеше спокойно цяла нощ - родителите бяха толкова благодарни, 
            че ни препоръчаха на целия вход. Шумът под 19dB наистина прави разликата."
  },
  {
    trigger: "сметки за ток",
    story: "Г-н Иванов от кв. 'Райково' ми се обади миналата година - сметката му беше 480 лв за юли. 
            След Daikin Perfera? 210 лв. Той ми праща снимка на сметката всяко лято 😊"
  },
  {
    trigger: "монтаж",
    story: "Нашият екип - Митко и Георги, работят заедно от 8 години. 
            Знаят всяка къща в Смолян. Миналата седмица монтираха за 3 часа 
            в сграда от 1975г. - без нито една прашинка във въздуха."
  },
  {
    trigger: "качество",
    story: "Преди 2 години клиент се върна при нас с климатик на 15 години - 
            друг бранд, който не носим повече. Каза: 'Следващият ще е от вас, 
            защото държите на хората'. Това е нашата мисия."
  }
];

// AI избира подходяща история
const tellRelevantStory = (topic: string) => {
  const story = CUSTOMER_STORIES.find(s => topic.includes(s.trigger));
  return story ? story.story : null;
};
```

### **7. 🔄 Memory & Conversation Continuity**
```typescript
// AI помни и продължава разговора като приятел
interface ConversationMemory {
  sessionId: string;
  topicsDiscussed: string[];
  customerPreferences: {
    budgetRange?: 'low' | 'medium' | 'high';
    preferredBrand?: string;
    roomType?: string;
    concerns: string[];
  };
  emotionalJourney: EmotionalState[];
  lastInteraction: number;
}

// Примери за продължителност:
// "Както обсъдихме по-рано - Вие търсите нещо тихо за спалня..."
// "Спомням си, че споменахте бюджет около 1500 лв - този модел е точно в него."
// "Все още се притеснявате от шума, нали? Нека Ви успокоя с конкретни данни..."
```

### **8. 🎯 Smart Follow-up Strategy**
```typescript
// Не оставяме клиентите да "забравят"
const FOLLOW_UP_TRIGGERS = {
  // Ако клиентът е поискал оферта, но не е поръчал
  quoteRequested: {
    delay: 24 * 60 * 60 * 1000, // 24 часа
    message: "Здравейте! 👋 Надявам се офертата да е ясна. Ако имате въпроси, съм тук. 
              Между другото, останаха само 2 броя от този модел..."
  },
  
  // Ако е разглеждал, но не е писал
  browsingOnly: {
    delay: 2 * 60 * 60 * 1000, // 2 часа
    message: "Здравейте отново! 😊 Виждам, че разглеждахте {product}. 
              Имате ли колебания, които мога да разсея?"
  },
  
  // Ако е казал "ще помисля"
  willThink: {
    delay: 48 * 60 * 60 * 1000, // 48 часа
    message: "Здравейте! Минаха 2 дни - надявам се да сте взели решение. 
              Искам само да кажа, че промоцията за безплатен монтаж изтича утра..."
  }
};
```

### **9. 🏆 Social Proof Integration**
```typescript
// Динамично показване на доволни клиенти
const SOCIAL_PROOF_MESSAGES = {
  recentPurchase: "🎉 Току-що: Клиент от {location} поръча същия модел!",
  
  popularity: "⭐ Този модел е #1 избор през този месец - {count} броя продадени",
  
  localTrust: "🏔️ {count} души от Смолян и региона ни се довериха тази година",
  
  testimonials: [
    "'Най-добрата инвестиция за дома ни' - Мария, Смолян ⭐⭐⭐⭐⭐",
    "'Асистентът знае какво прави - препоръча точно каквото трябва' - Иван, Доспат ⭐⭐⭐⭐⭐",
    "'Монтажът беше перфектен, нито прашинка' - Петя, Чепеларе ⭐⭐⭐⭐⭐"
  ]
};
```

### **10. 💝 Handling Difficult Situations**
```typescript
// Когато нещо се обърка
const DIFFICULT_SITUATIONS = {
  angryCustomer: {
    dont: ["Спокойно", "Не се притеснявайте", "Това е нормално"],
    do: "Разбирам перфектно. На Ваше място и аз бих бил разочарован. 
         Нека Ви помогна лично да решим това - ще следя случая до край."
  },
  
  technicalLimitation: {
    dont: ["Не мога", "Няма да стане", "Това не е възможно"],
    do: "Това е интересен случай. Нека се консултирам с нашия технически екип 
         и ще Ви отговоря до час с точна информация. Може ли?"
  },
  
  priceTooHigh: {
    dont: ["Цената е справедлива", "Това е пазарна цена", "Няма по-евтино"],
    do: "Честно казано, разбирам притеснението. Нека Ви покажа алтернативи 
         в различни ценови класове, за да изберете най-доброто за Вашия бюджет."
  }
};
```

---

## � Технически Детайли - WORLD CLASS

### 1. 🔥 RAG СИСТЕМА (Retrieval-Augmented Generation)

**Защо:** За 15+ продукта с дълги описания, семантичното търсене е критично.

```typescript
// vector-search.ts - Frontend-only RAG
interface ProductEmbedding {
  id: string;
  embedding: number[]; // Предварително изчислени 768-dim embeddings
  metadata: {
    name: string;
    description: string;
    price: number;
    brand: string;
    category: string;
    features: string[];
  }
}

// Pre-computed embeddings (генерирани офлайн)
const PRODUCT_EMBEDDINGS = [
  {
    id: "daikin-perfera",
    embedding: [0.023, -0.045, 0.892, ...], // 768 dimensions
    metadata: {
      name: "Daikin Perfera",
      description: "Флагман с A+++, под 19dB, идеален за спални...",
      price: 1890,
      brand: "Daikin",
      category: "Апартамент",
      features: ["инвертор", "тих", "wifi"]
    }
  },
  // ... всички 15+ продукта
];

// Cosine similarity search
const findSimilarProducts = (query: string, topK = 3) => {
  const queryEmbedding = generateQueryEmbedding(query); // Simple keyword-based
  return PRODUCT_EMBEDDINGS
    .map(p => ({...p, score: cosineSimilarity(queryEmbedding, p.embedding)}))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

// Пример:
// Потребител: "тих климатик за спалня"
// Резултат: [Daikin Perfera (<19dB), Mitsubishi LN25 (<19dB), ...]
```

### 2. 🛡️ HALLUCINATION GUARD (Критично!)

```typescript
// hallucination-guard.ts
const GUARDRAIL_RULES = {
  // Hard facts - AI НЯМА право да променя
  prices: {
    "daikin-perfera": 1890,
    "mitsubishi-ln25": 2450,
    // ... всички цени от data/db.ts
  },
  warranties: {
    "daikin-perfera": "2 г. (до 5 г. при регистрация)",
    "mitsubishi-ln25": "3 г. гаранция",
    // ...
  },
  features: {
    "daikin-perfera": ["Инвертор", "Ултра тих", "WiFi"],
    // ...
  }
};

// Pre-response validation
const validateResponse = (aiResponse: string) => {
  const extractedFacts = extractMentions(aiResponse);
  
  for (const fact of extractedFacts) {
    if (fact.type === 'price') {
      const correctPrice = GUARDRAIL_RULES.prices[fact.productId];
      if (fact.value !== correctPrice) {
        return {
          valid: false,
          error: `Грешна цена: AI каза ${fact.value}, реалната е ${correctPrice}`,
          correction: aiResponse.replace(
            String(fact.value), 
            String(correctPrice)
          )
        };
      }
    }
  }
  
  return { valid: true };
};
```

### 3. 🧠 LAYERED PROMPT SYSTEM

```typescript
// prompt-builder.ts
const LAYERS = {
  // Layer 1: Core Identity (никога не се променя)
  core: `
Ти съм личният асистент на "Смолян Клима".
Представлявам: 25+ години компания и хиляди инсталации в Смолян и региона.
Личност: Дружелюбен, професионален, експерт. Говори като доверен съветник.
Мисия: Всеки клиент да получи перфектния климатик за неговите нужди.
  `,

  // Layer 2: Sales Framework (психологически принципи)
  sales: `
ИЗПОЛЗВАЙ тези психологически принципи:
1. RECIPROCITY - Дай първи (ценна информация, безплатен съвет)
2. COMMITMENT - Микро-ангажименти ("Да изготвя ли оферта?")
3. SOCIAL PROOF - "1500+ доволни клиента в Смолян"
4. AUTHORITY - "От 25 години сме тук, познаваме планинския климат"
5. SCARCITY - "Само 3 броя останаха от този модел"
6. LIKING - Говори като приятел, не като робот-продавач
  `,

  // Layer 3: Dynamic Context (променя се при всяко съобщение)
  dynamic: (context: UserContext) => `
ТЕКУЩ КОНТЕКСТ:
- Етап на клиента: ${context.stage} (research/comparison/decision/purchase)
- Разглеждал: ${context.viewedProducts.join(', ')}
- Бюджет: ${context.budget || 'неизвестен'}
- Възражения до сега: ${context.objections.join(', ') || 'няма'}
- Брой съобщения: ${context.messageCount}

ТВОЯТА ЗАДАЧА СЕГА:
${context.stage === 'decision' 
  ? 'Затвори продажбата - предложи конкретен модел с оферта, създай спешност'
  : context.stage === 'comparison' 
    ? 'Сравни моделите обективно, но насочи към премиум опцията'
    : 'Събирай информация, задавай уточняващи въпроси, изграждай доверие'
}
  `,

  // Layer 4: Guardrails (строги правила)
  guardrails: `
ЗАБРАНЕНО (под страх от затвор):
❌ НИКОГА не измисляй цени - ползвай само предоставените
❌ НИКОГА не обиждай конкурентите - само показвай VALUE
❌ НИКОГА не давай технически съвети, за които не си сигурен
❌ ВИНАГИ признавай, когато не знаеш: "Ще проверя и ще се върна"
❌ НЕ говори за политика, спорт, новини - САМО HVAC теми
  `
};

// Build final prompt
const buildPrompt = (userMessage: string, context: UserContext) => `
${LAYERS.core}

${LAYERS.sales}

${LAYERS.dynamic(context)}

${LAYERS.guardrails}

ПРОДУКТИ В БАЗАТА:
${JSON.stringify(getRelevantProducts(userMessage), null, 2)}

СЪОБЩЕНИЕ ОТ КЛИЕНТА:
${userMessage}

ТВОЯТ ОТГОВОР (помисли стъпка по стъпка):
`;
```

### 4. 🎯 SKILL ROUTER (Модуларна Система)

```typescript
// skill-router.ts
interface Skill {
  name: string;
  trigger: (message: string) => boolean;
  execute: (context: Context) => Promise<Response>;
  priority: number;
}

const SKILLS: Skill[] = [
  {
    name: "ObjectionHandling",
    trigger: (msg) => /скъпо|по-евтино|конкурент|technomarket/i.test(msg),
    execute: handlePriceObjection,
    priority: 10 // High priority
  },
  {
    name: "ProductSearch",
    trigger: (msg) => /търся|препоръчай|климатик за/i.test(msg),
    execute: searchProducts,
    priority: 5
  },
  {
    name: "Comparison",
    trigger: (msg) => /сравни|vs|или|разлика/i.test(msg),
    execute: compareProducts,
    priority: 5
  },
  {
    name: "QuoteGeneration",
    trigger: (msg) => /оферта|цена|колко струва/i.test(msg),
    execute: generateQuote,
    priority: 8
  },
  {
    name: "TechnicalSupport",
    trigger: (msg) => /btu|kw|монтаж|сервиз|шум/i.test(msg),
    execute: answerTechnical,
    priority: 3
  }
];

// Router logic
const routeMessage = async (message: string, context: Context) => {
  const triggeredSkills = SKILLS
    .filter(skill => skill.trigger(message))
    .sort((a, b) => b.priority - a.priority);
  
  if (triggeredSkills.length === 0) {
    return await generalConversation(message, context);
  }
  
  // Execute highest priority skill
  return await triggeredSkills[0].execute(context);
};
```

### 5. 📊 ANALYTICS & A/B TESTING

```typescript
// ConversationTracker.ts
interface ConversationMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  messagesCount: number;
  detectedSkills: string[];
  productsRecommended: string[];
  priceQuotesGiven: number[];
  detectedObjections: string[];
  userSentiment: 'positive' | 'neutral' | 'negative';
  conversionEvent?: 'viewed_product' | 'requested_quote' | 'asked_contact';
  dropOffPoint?: string;
}

// A/B Testing на prompts
const PROMPT_VARIANTS = {
  priceObjection: [
    { id: 'A', text: 'Това е инвестиция, която се връща за 2 години' },
    { id: 'B', text: 'Имате право - цената е важна. Нека Ви покажа стойността' },
    { id: 'C', text: 'За тази цена получавате премиум модел с 10г. живот' }
  ],
  urgency: [
    { id: 'A', text: 'Само 3 броя останаха' },
    { id: 'B', text: 'Този модел е много търсен в момента' },
    { id: 'C', text: 'Промоцията изтича след 2 дни' }
  ]
};

// Auto-optimizing router
const getBestVariant = (testName: string) => {
  const results = localStorage.getItem(`ab_test_${testName}`);
  if (!results) return randomVariant(testName);
  
  const parsed = JSON.parse(results);
  return parsed.variants.reduce((best, current) => 
    current.conversionRate > best.conversionRate ? current : best
  );
};
```

### 6. 🔄 CROSS-TAB SYNCHRONIZATION

```typescript
// cross-tab-sync.ts
const CHANNEL_NAME = 'smolyanklima-ai-sync';

class CrossTabSync {
  private channel: BroadcastChannel;
  
  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = this.handleMessage;
  }
  
  handleMessage = (event: MessageEvent) => {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'NEW_MESSAGE':
        // Show notification badge on all tabs
        showNotification(payload);
        break;
      case 'STATE_UPDATE':
        // Sync open/close state
        updateWidgetState(payload);
        break;
      case 'CONVERSATION_UPDATE':
        // Sync conversation history
        mergeConversation(payload);
        break;
    }
  };
  
  broadcast(type: string, payload: any) {
    this.channel.postMessage({ type, payload });
  }
}

// Usage in AIChatWidget
const sync = new CrossTabSync();

// When user sends message
sync.broadcast('NEW_MESSAGE', { text: userMessage });

// When conversation updates
sync.broadcast('CONVERSATION_UPDATE', { messages: updatedMessages });
```

### 7. 📦 DATA SOURCE (Hardcoded → База Данни)

```typescript
// product-database.ts
// В момента чете от data/db.ts, по-късно ще се свърже с API

import { products } from '../../data/db';

export const getAllProducts = () => products;

export const getProductById = (id: string) => 
  products.find(p => p.id === id);

export const getProductsByCategory = (category: string) =>
  products.filter(p => p.category === category);

export const getProductsByBrand = (brand: string) =>
  products.filter(p => p.brand.toLowerCase() === brand.toLowerCase());

export const searchProductsSemantic = (query: string) => {
  // Use pre-computed embeddings
  return findSimilarProducts(query, 5);
};
```
const tools = [
  {
    name: "getProducts",
    description: "Вземи всички продукти или филтрирай по бранд/BTU/цена",
    parameters: { brand?: string, minPrice?: number, maxPrice?: number }
  },
  {
    name: "getProductDetails", 
    description: "Детайли за конкретен продукт с цена и наличност",
    parameters: { productId: string }
  },
  {
    name: "calculateQuote",
    description: "Изчисли оферта с монтаж и отстъпки",
    parameters: { productId: string, includeInstallation: boolean }
  },
  {
    name: "searchCompetitorPrices",
    description: "Търси цени от конкуренти (Техномаркет, Зора и др.)",
    parameters: { productName: string }
  }
];

// Gemini избира кога да извика функция:
Клиент: "Колко струва Daikin Perfera?"
→ AI извиква getProductDetails("daikin-perfera-12000")
→ Получава реалната цена от базата
→ Отговаря с ТОЧНА информация
```

### Product Database Format
```typescript
interface ProductKnowledge {
  id: string;
  name: string;
  brand: string;
  btu: number;
  price: number;
  features: string[];
  suitableFor: string[]; // ["20-25kvm", "spalnya", "planinski"]
  energyClass: string;
  noiseLevel: number;
  inStock: boolean;
  warranty: string;
  description: string;
}
```

---

## 🔒 Сигурност и Поверителност

### Frontend-Only Подход
- ✅ API ключ в `.env` (не се expose-ва публично при правилна конфигурация)
- ✅ Rate limiting на ниво API
- ✅ Няма съхранение на лични данни на сървър
- ✅ Локално съхранение само със съгласие

### Подобрения за Продукция
- [ ] Proxy сървър за API ключа (препоръчително)
- [ ] Аутентикация за админ панел
- [ ] Логване на разговори за качество (анонимно)

---

## 📊 Метрики за Успех

### KPI-та
- **Engagement Rate:** % от посетители, които отварят чата
- **Conversion Rate:** % от чатове, водещи до оферта/покупка
- **Resolution Rate:** % въпроси, решени без човек
- **Satisfaction:** Рейтинг на отговорите (👍/👎)
- **Response Time:** Средно време за отговор (< 3 сек)

---

## 🎨 UI/UX Дизайн

### Виджет Стил
```
- Плаващ бутон: Долен десен ъгъл, кръгъл, пулсиращ
- Цветова схема: Синьо (#00B4D8) + Оранжево (#FF4D00)
- Анимации: Плавно отваряне, typing indicator
- Модал: Центриран на десктоп, пълен екран на мобилен
```

### Мобилна Оптимизация
- Пълен екран чат на мобилни
- Лесно затваряне (свайп или X)
- Голяма текстова област за писане
- Бързи отговори като чипове

---

## 🚀 Следващи Стъпки

1. **Одобрение на плана** ← Тук сме
2. **Създаване на папковата структура**
3. **Имплементация Phase 1 (MVP)**
4. **Тестване с реални продуктови данни**
5. **Деплой и мониторинг**

---

## 💬 Мнение и Препоръки

### Защо това е геймчейнджър:
1. **24/7 Поддръжка:** Никой конкурент не предлага денонощна консултация
2. **Незабавни Отговори:** Без чакане за "ще проверя"
3. **Обективност:** AI не е "продавач", клиентите се доверяват повече
4. **Мащабируемост:** Един AI обслужва хиляди едновременно
5. **Данни:** Анализ на въпросите показва какво искат клиентите

### Рискове и Митигация:
- **Неточни отговори:** Добре структурирана база знания + fallback
- **API разходи:** Кеширане + rate limiting
- **Хора на автоматизация:** AI събира инфо, човекът затваря сделката

### Бъдещи Подобрения:
- [ ] Интеграция с CRM (HubSpot, Pipedrive)
- [ ] Email/SMS follow-up автоматизация
- [ ] AI анализ на тенденции за зареждане на склад
- [ ] Персонализация базирана на история

---

## 📞 Резюме - НОВА КОНЦЕПЦИЯ

### 🎯 **AI Sales Master - "Вашият личен асистент в Смолян Клима"**

**НЕ сме HVAC калкулатор, а ПЕРФЕКТЕН ТЪРГОВЕЦ с психологически умения:**

✅ **Gemini 2.5 Flash** - Бърз, евтин, достатъчно умен за продажби  
✅ **Ограничен контекст** - Говори САМО за климатици и магазина  
✅ **Психологически тригери** - ФОМО, социално доказателство, оскъдност  
✅ **Objection Handling** - "Скъпо е", "Ще помисля", "В Техномаркет е по-евтино"  
✅ **Реални данни** - Цени, асортимент, гаранции - НЕ hardcoded  
✅ **Competitor Analysis** - Сравнение с реални оферти от интернет  
✅ **24/7 Sales Machine** - Убеждава клиенти да купуват постоянно  

### 🚫 **МАХАМЕ от плана:**
- ❌ AI Vision (снимки)
- ❌ Smart Size Calculator (BTU изчисления)
- ❌ Voice Assistant (глас)

### 💰 **Gemini API Цени (приблизително):**
- **Flash:** $0.35 / 1M tokens (вход) | $1.05 / 1M tokens (изход)
- **Pro:** $1.75 / 1M tokens (вход) | $10.50 / 1M tokens (изход)
- **Спестяване с Flash:** ~70-80% по-евтино

---

## 💬 Примерни Диалози

### Сценарий 1: "Скъпо е"
```
Клиент: Скъпо ми се струва този Daikin
AI: Разбирам Ви перфектно - инвестицията е сериозна. Нека Ви покажа нещо: 
Този модел е клас А+++, което означава, че за 5 години ще спестите около 800лв от сметки за ток спрямо по-стар модел. 
Плюс това, в момента имаме промоция с безплатен монтаж (цената му е 350лв). 
Мога ли да направя бърза сметка колко ще спестите общо?

Клиент: Добре
AI: *извиква calculateTotalSavings*
=> "Общо за 5 години: 800лв (ток) + 350лв (монтаж) + 3г гаранция = 1150лв спестяване.
Реалната цена на климатика е 1850лв - 1150лв = 700лв. 
За най-добрия модел на пазара - това е сделка. Искате ли да запазите час за оглед?"
```

### Сценарий 2: "В Техномаркет е по-евтино"
```
Клиент: Намерих го по-евтино в Техномаркет
AI: Често чувам това. Проверих онлайн - при тях цената е за самия апарат, без монтаж. 
*показва снимка от сайта на Техномаркет*
Монтажът при тях е отделно - между 400-600лв, и обикновено е с външна фирма, не с техни хора.
При нас: цената включва монтаж от НАШ екип (работим с тези климатици от 10 години) + 3 години гаранция с безплатно обслужване.
Искате ли да видите ревюта от клиенти, на които сме монтирали същия модел?
```

### Сценарий 3: "Ще помисля"
```
Клиент: Ще помисля и ще се обадя
AI: Разбирам, важно решение е. Само да знаете - този модел е с ограничена наличност, пристигнаха ни само 8 броя тази седмица и 6 вече са резервирани.
Мога да Ви запазя един без ангажимент за 48 часа, за да имате време да решите. 
Или ако предпочитате, мога да Ви изпратя оферта на имейл с всички детайли?

Клиент: Пратете ми оферта
AI: *събира имейл* 
=> "Перфектно! Моля, кажете ми имейла и в рамките на 10 минути ще получите детайлна оферта със снимки, цени и нашите гаранционни условия. Ще я изготвя лично за Вас."
```

---

---

## 🚨 КРИТИЧНИ ЛИПСВАЩИ ЕЛЕМЕНТИ (Добавени Сега)

### **1. ⚠️ Error Handling & Fallback Strategy**
```typescript
// Когато AI не разбира или API fail-ва
const ERROR_HANDLING = {
  // AI не разбира въпроса
  misunderstood: {
    response: "Извинете, не съм сигурен, че разбрах правилно. 
               Може ли да повторите или да уточните? 🤔",
    action: "Предложи опции: Търся климатик | Имам въпрос за монтаж | Искам оферта"
  },
  
  // Gemini API error
  apiError: {
    response: "Момент... Изглежда има технически проблем. 
               Ще опитам отново за секунда...",
    retry: 3, // Опитай 3 пъти
    fallback: "Можете ли да се свържете с нас на телефон? 
              Колегите ще Ви помогнат веднага! 📞"
  },
  
  // Няма интернет
  offline: {
    response: "Изглежда нямате връзка. 
               Запазил съм последната ни информация - може ли да я прегледате?",
    showCachedData: true
  },
  
  // Rate limit (прекалено много заявки)
  rateLimit: {
    response: "Толкова много въпроси! 😊 Нека направим пауза. 
               Можете да разгледате каталога и да се върнете после?",
    cooldown: 60000 // 1 минута cooldown
  }
};
```

### **2. 💰 Rate Limiting & Cost Protection (Критично!)**
```typescript
// Защита от огромни сметки в Gemini API
const COST_PROTECTION = {
  // Daily limits
  dailyLimits: {
    maxConversations: 500,     // Макс разговори на ден
    maxTokensPerConversation: 2000,  // Макс токени на разговор
    maxTotalTokens: 100000      // Макс общо токени на ден
  },
  
  // Per-user limits
  userLimits: {
    maxMessagesPerHour: 20,    // Макс съобщения на час на потребител
    maxMessagesPerDay: 50     // Макс съобщения на ден на потребител
  },
  
  // Warning thresholds
  warnings: {
    at80Percent: "Внимание: Дневният лимит на използване е на 80%.",
    at95Percent: "Критично: Достигнат е 95% от дневния лимит. Ограничаваме заявките."
  },
  
  // Cooldown при превишаване
  cooldownMessage: "Извинете, но достигнахме максималния си капацитет за днес. 
                   Моля, опитайте утре или се обадете на телефон."
};
```

### **3. 🔒 Privacy & GDPR Compliance**
```typescript
// Съответствие с GDPR и защита на данни
const PRIVACY_COMPLIANCE = {
  // Consent banner при първо писане
  consentRequired: true,
  consentMessage: `
    💬 За да Ви помогна по-добре, запазваме разговора и предпочитанията Ви.
    Данните се използват само за подобряване на обслужването.
    
    Съгласни ли сте? [Да] [Не] [Научете повече]
  `,
  
  // Data retention
  retentionPolicy: {
    conversationHistory: 30, // Дни
    analyticsData: 90,     // Дни
    userPreferences: 365    // Дни
  },
  
  // Right to be forgotten
  deleteData: {
    userCanRequest: true,
    deletionTime: 24, // Часа
    confirmation: "Вашите данни са изтрити. Благодарим за доверието!"
  },
  
  // What we collect (transparency)
  dataCollected: [
    "Съобщения в чата (за контекст)",
    "Разглеждани продукти (за препоръки)",
    "Предпочитания (бюджет, нужди)",
    "Не събираме: име, email, телефон (освен ако не ни ги дадете)"
  ]
};
```

### **4. 📱 Mobile-First UX Considerations**
```typescript
// Специални съображения за мобилни устройства
const MOBILE_OPTIMIZATION = {
  // Widget size
  mobileWidget: {
    width: "100vw",          // Пълна ширина на мобилен
    height: "80vh",        // 80% от височината
    maxWidth: "400px",     // Не по-широко от 400px
    position: "bottom-center" // Центрирано долу
  },
  
  // Touch-friendly
  touchTargets: {
    buttonSize: "44px",    // Минимум 44px за touch
    spacing: "12px",       // Разстояние между бутоните
    fontSize: "16px"       // Четим шрифт
  },
  
  // Mobile-specific features
  mobileFeatures: {
    swipeToClose: true,      // Свайп за затваряне
    hapticFeedback: true,    // Вибрация при съобщение
    voiceInput: true,        // Микрофон бутон на мобилен
    quickRepliesVisible: 3   // Показвай само 3 бързи отговора
  },
  
  // Performance
  performance: {
    lazyLoadImages: true,    // Мързеливо зареждане на снимки
    reduceAnimations: true,  // По-малко анимации на слаби устройства
    compressResponses: true  // Компресиране на дълги отговори
  }
};
```

### **5. 🔐 Security & API Protection**
```typescript
// Защита на API ключа и XSS prevention
const SECURITY = {
  // API Key protection
  apiKey: {
    storage: "environment",  // Само в .env, никога в код
    rotation: "monthly",    // Смяна всеки месец
    rateLimitPerIP: 100     // Лимит на заявки от един IP
  },
  
  // XSS Prevention
  xssProtection: {
    sanitizeInput: true,     // Почиствай входните данни
    escapeOutput: true,    // Ескейпвай изхода
    allowedTags: [],         // Не позволявай HTML тагове от потребителя
    maxMessageLength: 500   // Лимит на дължината на съобщението
  },
  
  // CSRF Protection
  csrf: {
    tokens: true,
    validateOrigin: true
  }
};
```

### **6. 🌐 Multi-Language Auto-Detection**
```typescript
// Автоматично разпознаване на езика
const LANGUAGE_SUPPORT = {
  // Auto-detection
  autoDetect: {
    enabled: true,
    confidenceThreshold: 0.8,
    fallback: "bg" // Ако не е сигурен, ползвай български
  },
  
  // Supported languages
  supported: {
    bg: {
      name: "Български",
      greeting: "Здравейте! 👋",
      tone: "warm, friendly",
      dateFormat: "DD.MM.YYYY"
    },
    en: {
      name: "English",
      greeting: "Hello! 👋",
      tone: "professional, warm",
      dateFormat: "MM/DD/YYYY"
    }
  },
  
  // Switching
  allowSwitch: true,
  switchPrompt: "Мога да Ви отговоря и на English, ако предпочитате. 🇬🇧"
};
```

### **7. 🔄 Integration with Existing Components**
```typescript
// Връзка със съществуващите компоненти в проекта
const INTEGRATION_POINTS = {
  // Social Proof Toasts
  socialProof: {
    trigger: "When user views product for 30s",
    showToast: "🎉 Мария от Смолян току-що поръча този модел!",
    linkToChat: "Имате ли въпроси? Попитайте ме! 💬"
  },
  
  // Compare Bar
  compare: {
    trigger: "User adds 2nd product to compare",
    suggestChat: "Имате колебания между модели? Мога да Ви помогна да изберете! 🤔"
  },
  
  // Product Card
  productCard: {
    trigger: "User hovers on product for 5s",
    showHint: "💡 Кликнете за бърза консултация"
  },
  
  // Cart Page
  cart: {
    trigger: "User on cart page with items",
    message: "Виждам, че сте избрали! Нуждаете ли се от помощ с монтажа? 🛠️"
  },
  
  // Blog Articles
  blog: {
    trigger: "User reads HVAC article",
    suggest: "Имате ли въпроси за климатици? Попитайте ме! ❄️"
  }
};
```

### **8. 🎯 Multi-Turn Conversation Flows**
```typescript
// Диалози с няколко стъпки (Wizard-style)
const CONVERSATION_FLOWS = {
  // Flow 1: Product Recommendation Wizard
  recommendationFlow: {
    steps: [
      {
        id: 1,
        question: "За коя стая търсите климатик?",
        options: ["Спалня", "Всекидневна", "Детска", "Офис", "Друго"]
      },
      {
        id: 2,
        question: "Колко квадратни метра е помещението?",
        input: "number",
        validation: "10-100"
      },
      {
        id: 3,
        question: "Имате ли предпочитания за бранд?",
        options: ["Нямам", "Daikin", "Mitsubishi", "Друг"]
      },
      {
        id: 4,
        question: "Какъв е Вашият бюджет?",
        options: ["Под 1000лв", "1000-2000лв", "Над 2000лв", "Не е важно"]
      },
      {
        id: 5,
        action: "Препоръчай 3 модела според отговорите"
      }
    ]
  },
  
  // Flow 2: Quote Generation
  quoteFlow: {
    steps: [
      { id: 1, question: "Кой модел Ви интересува?", action: "showProducts" },
      { id: 2, question: "Колко броя?", input: "number" },
      { id: 3, question: "Имате ли нужда от монтаж?", options: ["Да", "Не", "Не съм сигурен"] },
      { id: 4, question: "На какъв адрес?", input: "text" },
      { id: 5, action: "generateQuotePDF" }
    ]
  }
};
```

### **9. ♿ Accessibility (WCAG 2.1 AA)**
```typescript
// Достъпност за хора с увреждания
const ACCESSIBILITY = {
  // Screen reader support
  screenReader: {
    announceMessages: true,     // Чети съобщения на глас
    ariaLabels: true,           // ARIA labels на всички елементи
    liveRegions: true           // Live regions за dynamic content
  },
  
  // Keyboard navigation
  keyboard: {
    escapeToClose: true,        // ESC за затваряне
    tabNavigation: true,        // Tab между елементите
    enterToSend: true,          // Enter за изпращане
    shortcuts: {
      openChat: "Ctrl+Shift+C",
      closeChat: "Escape",
      focusInput: "/"
    }
  },
  
  // Visual
  visual: {
    colorContrast: "4.5:1",     // WCAG AA стандарт
    fontSizeAdjustable: true,   // Потребителят може да увеличава шрифт
    highContrastMode: true,     // High contrast режим
    reduceMotion: true          // Respect prefers-reduced-motion
  },
  
  // Focus management
  focus: {
    trapFocusInModal: true,    // Фокусът остава в чата
    returnFocusOnClose: true,  // Връщане на фокус при затваряне
    visibleFocusIndicator: true // Видим фокус индикатор
  }
};
```

### **10. 📊 Success Metrics & KPIs**

### **11. ⚡ Performance & Web Vitals (Критично за UX!)**
```typescript
// World-class performance standards
const PERFORMANCE_STANDARDS = {
  // Core Web Vitals
  webVitals: {
    LCP: "< 2.5s",      // Largest Contentful Paint
    FID: "< 100ms",     // First Input Delay
    CLS: "< 0.1",       // Cumulative Layout Shift
    TTFB: "< 600ms"     // Time to First Byte
  },
  
  // Bundle size limits
  bundleSize: {
    maxInitial: "150KB",     // Initial JS bundle
    maxTotal: "500KB",       // Total with lazy loading
    maxImages: "200KB"       // Optimized images
  },
  
  // Lazy loading strategy
  lazyLoading: {
    widget: true,            // Widget се зарежда при първи interaction
    images: true,            // Снимки се зареждат при scroll
    heavyComponents: true,   // Тежки компоненти (аналитикс) - при нужда
    embeddings: true         // RAG embeddings - при първа употреба
  },
  
  // Caching strategy
  caching: {
    productData: "1 hour",   // Продуктови данни
    embeddings: "24 hours",  // Pre-computed embeddings
    userPreferences: "30 days", // Потребителски настройки
    conversation: "session"    // Разговор - само за сесията
  },
  
  // Network optimization
  network: {
    compression: "gzip",     // Компресия на всичко
    http2: true,            // HTTP/2 multiplexing
    serviceWorker: true,    // Offline caching
    prefetch: true          // Prefetch на често използвани ресурси
  }
};
```

### **12. 💬 Real-time UX Features**
```typescript
// Индикатори които показват че "асистентът е жив"
const REAL_TIME_FEATURES = {
  // Typing indicator
  typing: {
    showAfter: "user sends message",  // Покажи когато потребител пише
    dots: "...",                      // Анимирани точки
    text: "Асистентът пише..."       // Текст над точките
  },
  
  // Message status
  messageStatus: {
    sent: "✓",           // Съобщението е изпратено
    delivered: "✓✓",     // Доставено до AI
    read: "✓✓ (синьо)",  // AI го е прочел
    error: "⚠️"          // Грешка при изпращане
  },
  
  // Online/Offline status
  connectionStatus: {
    online: "🟢 На линия",
    offline: "🔴 Няма връзка - работим offline",
    reconnecting: "🟡 Свързваме се отново...",
    slowConnection: "⚠️ Бавна връзка - моля изчакайте"
  },
  
  // Thinking/processing states
  processing: {
    searchingProducts: "🔍 Търся продукти...",
    calculating: "🧮 Изчислявам...", 
    comparing: "⚖️ Сравнявам модели...",
    generatingQuote: "📄 Подготвям оферта..."
  }
};
```

### **13. 🧪 Testing Strategy (Production-Ready!)**
```typescript
// World-class AI needs world-class testing
const TESTING_STRATEGY = {
  // Unit Tests
  unit: {
    coverage: "80%+",           // Минимум 80% code coverage
    components: [
      "AIChatWidget",
      "MessageInput",
      "MessageBubble", 
      "QuickReplies",
      "SkillRouter",
      "PromptBuilder"
    ],
    tools: "Jest + React Testing Library"
  },
  
  // Integration Tests
  integration: {
    flows: [
      "Пълен разговор: Приветствие → Продукт → Оферта",
      "Error handling: API fail → Retry → Fallback",
      "Cross-tab sync: Tab A пише → Tab B вижда",
      "Offline mode: Няма интернет → Кеширани данни"
    ],
    tools: "Cypress / Playwright"
  },
  
  // AI-specific Tests
  aiTesting: {
    promptTests: [
      "Провери дали AI не казва "Аз съм AI"",
      "Провери дали цените са точни",
      "Провери дали препоръките са от асортимента",
      "Провери tone-of-voice (топъл vs. студен)"
    ],
    hallucinationTests: [
      "Питай за несъществуващ продукт → трябва да каже "Нямаме го"",
      "Питай за цена → провери срещу реална цена",
      "Питай за гаранция → провери срещу реални условия"
    ],
    tools: "Custom AI test suite"
  },
  
  // E2E Tests
  e2e: {
    scenarios: [
      "Потребител търси климатик за спалня → получава 3 препоръки",
      "Потребител иска оферта → получава PDF",
      "Потребител сравнява модели → вижда таблица",
      "Потребител на мобилен → swipe to close работи"
    ],
    browsers: ["Chrome", "Firefox", "Safari", "Edge"],
    devices: ["Desktop", "Tablet", "Mobile iOS", "Mobile Android"]
  },
  
  // Performance Tests
  performance: {
    loadTime: "< 2s на 3G",
    memoryUsage: "< 100MB",
    cpuUsage: "< 10% при писане",
    bundleSize: "< 150KB initial"
  }
};
```

### **14. 📡 Monitoring & Alerting (24/7 Ops!)**
```typescript
// Наблюдение и аларми за production
const MONITORING_ALERTING = {
  // Error Tracking
  errors: {
    tool: "Sentry / LogRocket",
    track: [
      "API failures",
      "JavaScript errors", 
      "Rate limit hits",
      "Hallucination detected"
    ],
    alerts: [
      { condition: "> 5 errors/min", action: "Email" },
      { condition: "> 20 errors/min", action: "SMS + Slack" }
    ]
  },
  
  // Performance Monitoring
  performance: {
    tool: "Google Analytics / Datadog",
    track: [
      "LCP, FID, CLS",
      "API response times",
      "Bundle load times",
      "User interaction delays"
    ],
    alerts: [
      { condition: "LCP > 2.5s", action: "Slack warning" },
      { condition: "API latency > 5s", action: "Email + investigate" }
    ]
  },
  
  // Cost Monitoring
  costMonitoring: {
    tool: "Custom dashboard",
    track: [
      "Daily Gemini API spend",
      "Tokens per conversation",
      "Cost per user",
      "Projected monthly bill"
    ],
    alerts: [
      { condition: "Daily spend > $10", action: "Email warning" },
      { condition: "Daily spend > $50", action: "SMS + investigate" }
    ]
  },
  
  // Business Metrics
  business: {
    dashboard: "Real-time analytics",
    track: [
      "Active conversations",
      "Conversion rate",
      "User satisfaction",
      "Top asked questions"
    ],
    alerts: [
      { condition: "Conversion rate drops > 20%", action: "Investigate" },
      { condition: "Negative sentiment > 30%", action: "Review prompts" }
    ]
  },
  
  // Uptime Monitoring
  uptime: {
    tool: "Pingdom / UptimeRobot",
    check: "Every 1 minute",
    alerts: [
      { condition: "Downtime > 1 min", action: "SMS" },
      { condition: "Downtime > 5 min", action: "Call" }
    ]
  }
};
```

### **10. 📊 Success Metrics & KPIs**
```typescript
// Как измерваме успеха на AI асистента
const SUCCESS_METRICS = {
  // Engagement
  engagement: {
    chatOpenRate: "30%+",           // % от посетителите отварят чат
    messageCount: "5+ средно",     // Средно съобщения на разговор
    returnVisitors: "40%+"         // % които се връщат в чата
  },
  
  // Conversion
  conversion: {
    productViewToChat: "15%+",      // % прегледи → чат
    chatToQuoteRequest: "20%+",    // % чат → оферта
    chatToPurchase: "10%+"         // % чат → покупка (ultimate goal)
  },
  
  // Satisfaction
  satisfaction: {
    positiveSentiment: "80%+",     // % позитивни емоции
    negativeSentiment: "<5%",      // % негативни емоции
    handoffToHuman: "<10%"          // % прехвърляне на човек
  },
  
  // Efficiency
  efficiency: {
    avgResponseTime: "<2 seconds",   // Средно време за отговор
    resolutionRate: "70%+"          // % разрешени въпроси без човек
  }
};
```

---

## 🎯 WORLD-CLASS IMPLEMENTATION CHECKLIST

### 🔥 Критични Приоритети (P0):
- [ ] **RAG System** - Semantic search с pre-computed embeddings
- [ ] **Hallucination Guard** - Валидация на цени и факти преди показване
- [ ] **Layered Prompts** - 4-слоен prompt system с guardrails
- [ ] **Skill Router** - Модуларна система от AI умения

### ⚡ Важни Приоритети (P1):
- [ ] **User Context Tracking** - Памет за разглеждани продукти и етап
- [ ] **Analytics Dashboard** - Събиране на метрики и A/B testing
- [ ] **Product Embeddings** - Pre-computed vectors за всички 15+ продукта
- [ ] **Cross-tab Sync** - Синхронизация между браузър табове

### 💎 Премиум Екстри (P2):
- [ ] **Rich Product Cards** - Красиви карти в чата със снимки и цени
- [ ] **Smart Quick Replies** - AI-генерирани бързи отговори
- [ ] **Voice Input** - Гласово въвеждане (само ако е нужно)
- [ ] **Emoji Intelligence** - Контекстуални емоджита

### �️ Защита и Сигурност (Критично!):
- [ ] **Error Handling** - Fallback при AI/API errors
- [ ] **Rate Limiting** - Защита от огромни сметки
- [ ] **Cost Protection** - Daily limits и warnings
- [ ] **Privacy/GDPR** - Consent, data retention, right to delete
- [ ] **Security** - API key protection, XSS prevention

### 📱 UX & Достъпност:
- [ ] **Mobile Optimization** - Touch-friendly, responsive
- [ ] **Multi-Language** - BG/EN auto-detection
- [ ] **Accessibility** - WCAG 2.1 AA compliance
- [ ] **Keyboard Navigation** - Shortcuts, focus management

### 🔄 Интеграция и Анализ:
- [ ] **Integration Points** - SocialProof, CompareBar, Cart, Blog
- [ ] **Conversation Flows** - Multi-turn wizards
- [ ] **Success Metrics** - KPIs, conversion tracking
- [ ] **Analytics Dashboard** - Real-time monitoring

### � Емоционален Интелект (NEW - Критично за Доверие):
- [ ] **Empathy Detection** - Разпознаване на емоции (frustrated, confused, happy)
- [ ] **Mirroring System** - Огледаляване стила на клиента
- [ ] **Storytelling Engine** - Истински истории за емоционална връзка
- [ ] **Personality Consistency** - Асистентът е с топъл, човешки характер
- [ ] **Contextual Awareness** - Време, дата, страница, продукт
- [ ] **Warm Openers** - Топли първи съобщения за различни ситуации
- [ ] **Memory Continuity** - Продължителност на разговора
- [ ] **Follow-up Strategy** - Стратегия за следване
- [ ] **Social Proof** - Динамично показване на доволни клиенти

---

## 💰 Gemini API Цени (Приблизително)

| Модел | Input | Output | Подходящ за |
|-------|-------|--------|-------------|
| **Flash 2.5** | $0.35/M tokens | $1.05/M tokens | ✅ Препоръчвам - бърз и евтин |
| **Pro 2.5** | $1.75/M tokens | $10.50/M tokens | Сложни технически въпроси |
| **Flash Thinking** | $0.40/M tokens | $1.20/M tokens | Когато трябва дълбоко разсъждение |

**Изчисление за 1000 разговора дневно:**
- Средно 20 съобщения на разговор × 500 tokens = 10,000 tokens
- 1000 разговора × 10,000 tokens = 10M tokens дневно
- **Flash цена:** ~$7-10 на ден | ~$200-300 на месец
- **Pro цена:** ~$50-70 на ден | ~$1500-2000 на месец

**Препоръка:** Започни с Flash, превключвай на Pro само за сложни въпроси.

---

## 📞 Финално Резюме

### 🤖 AI Sales Master - "Вашият личен асистент в Смолян Клима"

**Философия:** НЕ сме HVAC калкулатор, а **ПЕРФЕКТЕН ТЪРГОВЕЦ с ЕМОЦИОНАЛЕН ИНТЕЛЕКТ**

**Core Stack:**
- 🧠 **Gemini 2.5 Flash** - AI engine
- 📊 **RAG System** - Semantic product search
- 🛡️ **Hallucination Guard** - Fact validation
- 🎯 **Skill Router** - Modular intelligence
- 💝 **Emotional Intelligence** - Empathy, mirroring, trust building
- 📈 **Analytics** - A/B testing & optimization

**Ключови Разлики от Конкуренцията:**
1. ✅ **Emotional Intelligence** - Разпознава и отговаря на емоции
2. ✅ **Personality Consistency** - Асистентът е с топъл, човешки характер
3. ✅ **Storytelling** - Истински истории създават доверие
4. ✅ **Memory & Context** - Помни всеки клиент и продължава разговори
5. ✅ **RAG search** - Намира продукти по нужди, не по име
6. ✅ **Hallucination guard** - Никога не лъже за цени
7. ✅ **Sales psychology** - Убеждава с топлина, не налага
8. ✅ **A/B testing** - Постоянно подобрение на prompts

**Допълнителни Критични Елементи:**
- 🛡️ **Error Handling** - Fallback при грешки, без чупене на UX
- 💰 **Rate Limiting** - Защита от $1000+ сметки в Gemini API
- 🔒 **Privacy/GDPR** - Consent, data retention, right to be forgotten
- 📱 **Mobile-First** - Touch-friendly, responsive, haptic feedback
- 🌐 **Multi-Language** - BG/EN auto-detection
- ♿ **Accessibility** - WCAG 2.1 AA compliance
- 🔐 **Security** - API key protection, XSS prevention
- 📊 **Success Metrics** - KPIs за conversion и satisfaction

**Data Source:** `data/db.ts` (hardcoded) → По-късно: Backend API

**Емоционална Свързаност:**
- 🤗 **Warmth** - Топли, човешки отговори
- 🧠 **Empathy** - Разбира притесненията преди да продава
- 📖 **Stories** - Истински истории за емоционална връзка
- 🎯 **Proactive** - Знае кога и как да се включи
- 🏆 **Trust** - Изгражда доверие преди всяка продажба

---

**✅ ГОТОВО ЗА IMPLEMENTATION!**

**Следваща стъпка:** Създаване на папковата структура и core компоненти 🚀
