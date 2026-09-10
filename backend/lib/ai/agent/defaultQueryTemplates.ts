export type DefaultQueryTemplate = {
  title: string;
  prompt: string;
  description?: string;
};

export const DEFAULT_AGENT_QUERY_TEMPLATES: DefaultQueryTemplate[] = [
  {
    title: "Критични срокове МПС",
    prompt: "Кои МПС имат критични или изтекли срокове?",
    description: "Алерти по винетка, гражданска отговорност, преглед, каско",
  },
  {
    title: "Разходи автопарк",
    prompt: "Разходи автопарк за текущата година — breakdown по МПС и вид",
    description: "Compliance, поддръжка и ремонти",
  },
  {
    title: "Поддръжки 30 дни",
    prompt: "Поддръжки и ремонти в автопарка за последните 30 дни",
    description: "Сервизни събития и разходи",
  },
  {
    title: "Контейнери година",
    prompt: "Обобщение контейнери за текущата година — брой климатици и средна цена на бройка",
    description: "Разходи по доставки от Япония",
  },
  {
    title: "Най-скъп контейнер",
    prompt: "Кой контейнер е най-скъп и колко продукта има?",
    description: "Сравнение на разходи по контейнери",
  },
];
