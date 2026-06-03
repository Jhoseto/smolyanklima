import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  Heart,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { HeroBackground } from '../components/sections/HeroBackground';
import { StatsSection } from '../components/sections/StatsSection';
import { AboutCertificatesSection } from '../components/sections/AboutCertificatesSection';
import { SiteSeo } from '../components/seo/SiteSeo';
import { PAGE_SEO } from '../lib/seo/config';
import { breadcrumbSchema, localBusinessSchema } from '../lib/seo/jsonLd';
import { COMPANY_TEL_HREF, LEGAL_COMPANY } from '../data/legal/company';

const ABOUT_HERO_IMAGE = '/images/about-hero.png';

const milestones = [
  {
    year: '1990-те',
    title: 'Началото в Смолян',
    text: 'Започнах с една мечта — хората в планината да имат същия комфорт и качество, както в големите градове. Първите монтажи бяха ръчна работа, но всеки клиент беше като съсед.',
  },
  {
    year: '2000-те',
    title: 'Растеж и доверие',
    text: 'Разширихме обслужването към Рудозем, Мадан, Девин и околните села. Научих, че репутацията се печели с точен монтаж и честна гаранция — не с реклама.',
  },
  {
    year: '2010-те',
    title: 'Модерни системи',
    text: 'Инверторните технологии промениха индустрията. Инвестирах в обучение и сертификации, за да предлагаме водещи марки — Mitsubishi, Daikin, Fujitsu, Toshiba и други.',
  },
  {
    year: 'Днес',
    title: 'Смолян Клима',
    text: 'Над 3000 монтирани климатика, екип от доказани специалисти и магазин с шоу-рум в Смолян. Все още отговарям лично на всеки, който ни се довери.',
  },
];

const values = [
  {
    icon: ShieldCheck,
    title: 'Честност пред всичко',
    text: 'Казвам какво е най-подходящо за вашия дом — не какво е най-скъпо.',
  },
  {
    icon: Wrench,
    title: 'Майсторство в монтажа',
    text: 'Климатикът е толкова добър, колкото е добър монтажът. Тук не правим компромиси.',
  },
  {
    icon: Heart,
    title: 'Грижа след продажбата',
    text: 'Гаранция, профилактика и сервиз — защото връзката с клиента не свършва на касата.',
  },
  {
    icon: Users,
    title: 'Локален партньор',
    text: 'Живеем тук, работим тук. Знаем климата на Родопите и нуждите на хората от региона.',
  },
];

export default function AboutPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
      <SiteSeo
        config={PAGE_SEO.about}
        schemas={[
          localBusinessSchema(),
          breadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: 'За нас', path: '/za-nas' },
          ]),
        ]}
      />
      {/* Hero — full-bleed image отдясно, fade наляво към HeroBackground */}
      <section className="relative min-h-[420px] sm:min-h-[480px] lg:min-h-[580px] overflow-hidden">
        <HeroBackground className="bg-left" style={{ backgroundPosition: 'left center' }} />

        <div className="absolute inset-0 pointer-events-none">
          <img
            src={ABOUT_HERO_IMAGE}
            alt="Костадин Георгиев — основател на Смолян Клима"
            width={1920}
            height={1080}
            decoding="async"
            fetchPriority="high"
            className="about-hero-image"
          />
        </div>

        <div className="relative z-10 pt-[calc(var(--navbar-height)+2rem)] pb-16 lg:pb-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-center min-h-[320px] lg:min-h-[420px]">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full min-w-0 lg:col-span-5"
              >
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 backdrop-blur-sm border border-[#FFDCC2]/80 rounded-full mb-6 text-sm font-semibold text-[#FF5722]">
                  <Sparkles className="w-4 h-4" />
                  За нас
                </span>
                <h1 className="text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem] font-extrabold leading-[1.08] tracking-tight mb-6">
                  <span className="font-light text-gray-800">Историята на</span>
                  <br />
                  <span className="inline-block mt-1">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D]">
                      Смолян
                    </span>{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6]">
                      Клима
                    </span>
                  </span>
                </h1>
                <p className="text-lg text-[#374151] leading-relaxed font-medium max-w-xl">
                  Аз съм <strong className="text-gray-900">Костадин Георгиев</strong> — основател
                  на Смолян Клима. От десетилетия изграждам бизнес, основан на думата, майсторството и
                  уважението към всеки клиент в Смолян и региона.
                </p>
              </motion.div>
            </div>
          </div>
        </div>

      </section>

      <StatsSection />

      {/* Story — first person */}
      <section className="py-20 lg:py-28 bg-white relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-bold uppercase tracking-widest text-[#00B4D8] mb-4">
              Моята история
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-10 leading-tight">
              От първия монтаж до лидер на местния пазар
            </h2>

            <div className="space-y-6 text-[1.05rem] text-gray-700 leading-[1.85]">
              <p>
                Започнах в епоха, в която климатикът в Смолян беше лукс, а не необходимост. 
                Видях обаче как хората се топлят на дърва и въглища и как печките димят от сутрин до вечер. 
                Децата живееха в нездравословна среда, и повечето от родителите не осъзнаваха това.
                Вдъхновен от безупречното качество на японските технологии от онова време, 
                реших да предложа на хората нещо повече от модерна машина — да дам{' '}
                <em className="text-gray-900 not-italic font-semibold">спокойствие в домовете им</em>!
              </p>
              <p>
                Първите години бяха трудни. Работех почти сам, правих монтажите, учех
                схемите на новите инверторни системи нощем и на следващия ден обяснявах на клиента
                защо е по-добре да инвестира в качество, отколкото да купи най-евтиното. Много от
                онези първи клиенти ни помагат да градим доверие до ден днешен. Това е награда, която
                не се купува, а се печели с търпение и уважение към нуждите на всеки клиент.
              </p>
              <p>
                С времето изградих екип от хора, които мислят като мен: точни, честни, горди от
                работата си. Разширихме дейноста си в целия Смолянски регион и обслужваме обекти до най-крайните населени места.
                Достигнахме нива на услугите до степен да можем да оборудваме сгради и офиси на големи корпоративни клиенти
                в цялата страна. 
                Всеки обект е различен: понякога е просто стая с гледка към планината, в други случаи е
                офис с десетки служители и специфично оборудване нуждаещо се от специализирана климатизация. 
                Научих се да слушам, преди да предложа решение, така всеки един клиент разбира с времето, че говоря на един език с него.
              </p>
              <p>
                Днес „Смолян Клима“ е синоним на доверие. Продаваме водещи световни марки, но не просто
                „продаваме“ — а консултираме. Монтираме бързо, но не бързаме там, където
                качеството изисква време. И когато някой се обади след години за профилактика или
                сервиз — отговарям с удоволствие, защото знам, че сме част от ежедневието му.
              </p>
              <p className="text-gray-900 font-medium border-l-4 border-[#FF4D00] pl-5 py-1">
                „Не съм огромна верига - супермаркет, която просто продава климатици. Изградих място, където хората
                знаят, че ще бъдат чути, обслужени и защитени — днес и след години.“
              </p>
              
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-[#FAFAFA] relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <HeroBackground />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold uppercase tracking-widest text-[#FF4D00] mb-3">
              Пътят ни
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Как се разви бизнесът
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {milestones.map((item, i) => (
              <motion.article
                key={item.year}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="inline-block text-xs font-black uppercase tracking-wider text-[#00B4D8] bg-[#EBF5FF] px-3 py-1 rounded-full mb-4">
                  {item.year}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[#00B4D8] mb-3">
              Философия
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
              В какво вярваме
            </h2>
            <p className="text-gray-600">
              Всяко решение — от избора на модел до последня болт на конзолата — отразява тези
              принципи.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="text-center p-6 rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-[#FAFAFA]"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-[#FFF5ED] to-white border border-[#FFDCC2] flex items-center justify-center">
                  <v.icon className="w-6 h-6 text-[#FF5722]" strokeWidth={1.75} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{v.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <AboutCertificatesSection />

      {/* Location + CTA */}
      <section className="py-20 relative overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Award className="w-10 h-10 text-[#FF5722] mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Елате при нас в Смолян
          </h2>
          <p className="text-gray-700 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            Посетете нашия магазин в кв. Райково — ще ви покажем модели на живо, ще изчислим
            мощността за вашето пространство и ще дадем честна оферта с монтаж и гаранция.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 text-gray-800">
            <span className="inline-flex items-center gap-2 font-medium">
              <MapPin className="w-5 h-5 text-[#00B4D8]" />
              ул. Наталия 19, кв. Райково, Смолян
            </span>
            <span className="hidden sm:block text-gray-300">|</span>
            <a
              href={COMPANY_TEL_HREF}
              className="inline-flex items-center gap-2 font-bold hover:text-[#FF4D00] transition-colors"
            >
              <Phone className="w-5 h-5 text-[#00B4D8]" />
              {LEGAL_COMPANY.phone}
            </a>
          </div>
          <Link
            to="/contact"
            className="inline-flex h-14 px-8 rounded-full bg-gradient-to-r from-[#FF5722] to-[#FF2A4D] text-white font-bold text-lg items-center gap-2 hover:shadow-lg hover:shadow-red-500/30 transition-all"
          >
            Свържете се с нас
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
