/**
 * AI Assistant Knowledge Base - Prompts
 * Pre-built prompts and templates
 */

/**
 * Welcome message templates by time and context
 */
export const welcomeMessages = {
  morning: 'Добро утро! ☀️ Готов ли сте да намерим перфектния климатик?',
  afternoon: 'Здравейте! 👋 Как мога да направя деня Ви по-хубав?',
  evening: 'Добър вечер! 🌙 Имате ли въпроси за климатика?',
  summer: 'Горещо е навън, нали? 🌡️ Нека Ви помогна да намерите прохлада!',
  winter: 'Студено е - идеално време за климатик! ❄️',
  returning: 'Здравейте отново! 😊 Радвам се да Ви видя пак!',
  newVisitor: 'Здравейте! Аз съм Вашият личен асистент от Смолян Клима. Как мога да помогна?',
};

/**
 * Objection handling response templates
 */
export const objectionResponses = {
  price: {
    empathize: 'Разбирам перфектно - инвестицията е сериозна.',
    valueProposition: 'Нека Ви покажа колко ще спестите за 3 години...',
    alternatives: 'Имаме и по-евтини алтернативи с отлично качество.',
    urgency: 'Промоцията изтича в петък - ще спестите 200 лв!',
  },
  timing: {
    empathize: 'Разбирам, че искате да помислите.',
    urgency: 'Имайте предвид, че сезонът започва и монтажните екипи се запълват бързо.',
    seasonal: 'Сега е идеалното време - цените са най-ниски преди сезона.',
    reservation: 'Мога да запазя промоцията за 24 часа без ангажимент.',
  },
  competitor: {
    acknowledge: 'Виждал съм тази оферта.',
    differentiators: 'Нека Ви покажа разликата в гаранцията и обслужването...',
    valueAdd: 'При нас получавате безплатен оглед, инсталация от сертифицирани техници и 24/7 поддръжка.',
    socialProof: '95% от клиентите ни са доволни и се връщат за втори климатик.',
  },
};

/**
 * Story templates for building trust
 */
export const stories = {
  energySavings: [
    'Г-н Иванов от Райково ми праща снимка на сметката всяко лято. Първата година спести 280 лв, миналата - 320 лв.',
    'Семейство от Доспат търсеха "най-евтиното". Сега ми благодарят, че ги насочих към енергийно ефективен модел.',
  ],
  quietOperation: [
    'Миналия месец инсталирахме на младо семейство с бебе. Избраха най-тихия модел - сега бебето спи спокойно.',
  ],
  professionalInstallation: [
    'Нашият екип - Митко и Георги, работят заедно от 8 години. Знаят всяка къща в Смолян.',
    'Баба Мария от Триград каза: "Не разбирам от коефициенти, но знам че съм топла и сметката е половинка".',
  ],
  customerSatisfaction: [
    'Миналата година инсталирахме 47 климатици. Този месец 12 от тези клиенти ни препоръчаха на приятели.',
    '73% от клиентите ни се връщат за втори климатик. Това не е случайно.',
  ],
};

/**
 * Call to action templates
 */
export const callToActions = {
  productRecommendation: 'Искате ли да Ви покажа топ 3 модела за Вашите нужди?',
  quoteRequest: 'Мога да изготвя оферта за 2 минути. Интересува ли Ви?',
  scheduleCall: 'Кога е удобно да Ви се обадим за 5-минутен разговор?',
  addToCart: 'Да добавя ли модела в кошницата Ви?',
  compare: 'Искате ли да сравним този модел с подобни?',
  reservation: 'Мога да запазя модела за 24 часа безплатно.',
  contact: 'Имате ли други въпроси? Аз съм тук!',
};

/**
 * Technical FAQ templates
 */
export const technicalFAQ = {
  installationTime: 'Монтажът отнема 3-4 часа за стандартна инсталация.',
  warranty: 'Daikin и Mitsubishi имат 36 месеца гаранция, други марки - 24 месеца.',
  noise: 'Съвременните климатици работят на 19-25 dB - по-тихи от шепот.',
  energySavings: 'Инверторните климатици спестяват 30-50% от сметките за ток.',
  maintenance: 'Препоръчваме профилактика веднъж годишно - 80 лв.',
};

/**
 * Get random story by category
 */
export function getRandomStory(category: keyof typeof stories): string {
  const categoryStories = stories[category];
  return categoryStories[Math.floor(Math.random() * categoryStories.length)];
}

/**
 * Get welcome message by context
 */
export function getWelcomeMessage(context: {
  hour: number;
  month: number;
  isReturning: boolean;
}): string {
  if (context.isReturning) {
    return welcomeMessages.returning;
  }
  
  // Check season (summer: May-August, winter: November-February)
  if (context.month >= 4 && context.month <= 7) {
    return welcomeMessages.summer;
  }
  if (context.month >= 10 || context.month <= 1) {
    return welcomeMessages.winter;
  }
  
  // Check time of day
  if (context.hour < 12) return welcomeMessages.morning;
  if (context.hour < 18) return welcomeMessages.afternoon;
  return welcomeMessages.evening;
}
