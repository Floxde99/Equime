import { SPACE_TYPE_LABELS } from '@equime/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '@/components/ui/alert.jsx';
import { BrandLockup } from '@/components/ui/brand-lockup.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { SkipLink } from '@/components/ui/skip-link.jsx';
import { fetchPublicPlans } from '@/features/billing/api.js';
import { fetchPublicEvents } from '@/features/engagement/api.js';
import { fetchPublicCourses, subscribeNewsletter } from '@/features/home/api.js';
import { clubContact } from '@/lib/clubContact.js';
import { onInPageAnchorClick } from '@/lib/inPageScroll.js';
import { formatEuroCents, formatEventPrice, formatMonthlyPlanPrice } from '@/lib/money.js';
import {
  formatCourseHours,
  formatSessionsPerWeek,
  isRedundantPlanDescription,
} from '@/lib/publicSchedule.js';
import { cn } from '@/lib/utils.js';

const PROGRAMS = [
  {
    title: 'Dressage classique',
    src: '/images/programme-dressage.webp',
    text: 'Travail de la locomotion, de la justesse et de la complicité, du galop 2 au haut niveau.',
  },
  {
    title: 'CSO et obstacle',
    src: '/images/programme-obstacle.webp',
    text: 'Progression sur barres au sol puis parcours, avec une cavalerie adaptée à chaque niveau.',
  },
  {
    title: 'Poney club',
    src: '/images/programme-poney.webp',
    text: 'Éveil, premier galop et concours poney : un parcours pensé pour les plus jeunes.',
  },
];

const SHOWCASE_EVENTS = [
  {
    id: 'showcase-printemps',
    title: 'Stage de printemps',
    startAt: '2026-06-15T09:00:00',
    location: 'Grand manège',
    description: 'Cinq jours de travail à pied et monté, tous niveaux.',
    priceCents: 15000,
  },
  {
    id: 'showcase-derby',
    title: 'Spring Hunter Derby',
    startAt: '2026-09-02T10:00:00',
    location: 'Carrière d’honneur',
    description: 'Épreuve club ouverte aux cavaliers du centre.',
    priceCents: 800,
  },
];

const joinClass =
  'inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-primary-fg hover:bg-primary-light';
const primaryClass =
  'inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 font-sans text-sm font-semibold text-primary-fg hover:bg-primary-light';
const outlinePhotoClass =
  'inline-flex h-12 items-center justify-center rounded-md border border-white px-8 font-sans text-sm font-semibold text-white hover:bg-white/10';
const outlineLightClass =
  'inline-flex h-11 items-center justify-center rounded-md border border-border-on-card bg-card px-6 font-sans text-sm font-semibold text-on-card hover:bg-paper';

/**
 * Ancre interne : défilement fluide vers la section (sans saut brutal).
 * @param {{ href: string, className?: string, children: import('react').ReactNode }} props
 */
function InPageLink({ href, className, children }) {
  return (
    <a href={href} className={className} onClick={onInPageAnchorClick}>
      {children}
    </a>
  );
}

/**
 * Vitrine publique — artboard Stitch desktop (serif, photo, vert forêt).
 */
export function HomePage() {
  const {
    data: apiEvents = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['public-events'],
    queryFn: fetchPublicEvents,
  });
  const plansQuery = useQuery({
    queryKey: ['public-plans'],
    queryFn: fetchPublicPlans,
  });
  const coursesQuery = useQuery({
    queryKey: ['public-courses'],
    queryFn: fetchPublicCourses,
  });
  const events = apiEvents.length > 0 ? apiEvents.slice(0, 2) : SHOWCASE_EVENTS;

  return (
    <div className="flex min-h-screen flex-col bg-card text-on-card">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-border-on-card bg-card">
        <nav
          aria-label="Navigation principale"
          className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-8 py-5"
        >
          <Link to="/" className="justify-self-start">
            <BrandLockup tone="light" showMark={false} />
          </Link>
          <ul className="hidden items-center gap-8 font-sans text-sm text-muted-on-card md:flex">
            <li>
              <InPageLink href="#contenu" className="hover:text-on-card">
                Accueil
              </InPageLink>
            </li>
            <li>
              <InPageLink href="#centre" className="hover:text-on-card">
                Le centre
              </InPageLink>
            </li>
            <li>
              <InPageLink href="#programmes" className="hover:text-on-card">
                Programmes
              </InPageLink>
            </li>
            <li>
              <InPageLink href="#formules" className="hover:text-on-card">
                Formules
              </InPageLink>
            </li>
            <li>
              <InPageLink href="#cours" className="hover:text-on-card">
                Cours
              </InPageLink>
            </li>
            <li>
              <InPageLink href="#evenements" className="hover:text-on-card">
                Événements
              </InPageLink>
            </li>
            <li>
              <InPageLink href="#temoignage" className="hover:text-on-card">
                À propos
              </InPageLink>
            </li>
          </ul>
          <div className="flex items-center justify-end gap-4">
            <Link
              to="/login"
              className="hidden font-sans text-sm font-medium text-on-card hover:text-primary sm:inline"
            >
              Connexion
            </Link>
            <Link to="/register" className={joinClass}>
              Nous rejoindre
            </Link>
          </div>
        </nav>
      </header>

      <main id="contenu" className="flex-1 scroll-mt-24">
        <section className="relative min-h-[34rem] overflow-hidden md:min-h-[38rem]">
          <img
            src="/images/hero-centre.webp"
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/45" />
          <div className="relative mx-auto flex min-h-[34rem] w-full max-w-4xl flex-col items-center justify-center px-6 py-24 text-center md:min-h-[38rem]">
            <h1 className="font-display text-4xl leading-[1.1] text-white md:text-6xl lg:text-7xl">
              Là où l&apos;excellence moderne rencontre la tradition équestre
            </h1>
            <p className="mt-6 max-w-xl font-sans text-sm leading-relaxed text-white/90 md:text-base">
              Un centre pensé pour le cheval et le cavalier : cours, cavalerie et suivi de saison,
              dans le respect de la tradition.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link to="/register" className={primaryClass}>
                Réserver un cours d&apos;essai
              </Link>
              <InPageLink href="#centre" className={outlinePhotoClass}>
                Découvrir le centre
              </InPageLink>
            </div>
          </div>
        </section>

        <section id="programmes" className="scroll-mt-24 bg-card px-8 py-24">
          <div className="mx-auto max-w-7xl">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-muted-on-card">
              Notre savoir-faire
            </p>
            <h2 className="mt-3 font-display text-4xl text-on-card md:text-5xl">
              Des programmes d&apos;exception
            </h2>
            <ul className="mt-14 grid gap-12 md:grid-cols-3">
              {PROGRAMS.map((program) => (
                <li key={program.title}>
                  <img src={program.src} alt="" className="aspect-[4/3] w-full object-cover" />
                  <h3 className="mt-6 font-display text-2xl text-on-card">{program.title}</h3>
                  <p className="mt-3 font-sans text-sm leading-relaxed text-muted-on-card">
                    {program.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="formules" className="scroll-mt-24 bg-paper px-8 py-24">
          <div className="mx-auto max-w-7xl">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-muted-on-card">
              Abonnements
            </p>
            <h2 className="mt-3 font-display text-4xl text-on-card md:text-5xl">Nos formules</h2>
            <QueryState
              isPending={plansQuery.isPending}
              isError={plansQuery.isError}
              error={plansQuery.error}
              onRetry={plansQuery.refetch}
            >
              {(plansQuery.data ?? []).length === 0 ? (
                <p className="mt-10 font-sans text-sm text-muted-on-card">
                  Les formules seront bientôt publiées.
                </p>
              ) : (
                <ul className="mt-14 grid gap-8 md:grid-cols-3">
                  {(plansQuery.data ?? []).map((plan) => (
                    <li key={plan.id} className="border border-border-on-card bg-card p-8">
                      <h3 className="font-display text-2xl text-on-card">{plan.name}</h3>
                      <p className="mt-3 font-sans text-3xl font-semibold text-on-card">
                        {formatMonthlyPlanPrice(plan.priceCents)}
                      </p>
                      <p className="mt-2 font-sans text-sm text-muted-on-card">
                        {formatSessionsPerWeek(plan.sessionsPerWeek)}
                      </p>
                      {plan.description &&
                      !isRedundantPlanDescription(plan.description, plan.sessionsPerWeek) ? (
                        <p className="mt-4 font-sans text-sm leading-relaxed text-muted-on-card">
                          {plan.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
            {clubContact.licenseCents != null || clubContact.cotisationCents != null ? (
              <div className="mt-10">
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-on-card">
                  Hors formule
                </p>
                <ul className="mt-3 space-y-2 font-sans text-sm text-on-card">
                  {clubContact.licenseCents != null ? (
                    <li>Licence FFE : {formatEuroCents(clubContact.licenseCents)}</li>
                  ) : null}
                  {clubContact.cotisationCents != null ? (
                    <li>Cotisation club : {formatEuroCents(clubContact.cotisationCents)}</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section id="cours" className="scroll-mt-24 bg-card px-8 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-muted-on-card">
                  Planning
                </p>
                <h2 className="mt-3 font-display text-4xl text-on-card md:text-5xl">
                  Prochaines séances
                </h2>
              </div>
              <Link
                to="/register"
                className="font-sans text-sm font-medium text-muted-on-card underline-offset-4 hover:text-on-card hover:underline"
              >
                Créer un compte pour s&apos;inscrire
              </Link>
            </div>
            <QueryState
              isPending={coursesQuery.isPending}
              isError={coursesQuery.isError}
              error={coursesQuery.error}
              onRetry={coursesQuery.refetch}
            >
              {(coursesQuery.data ?? []).length === 0 ? (
                <p className="font-sans text-sm text-muted-on-card">
                  Aucune séance n&apos;est encore ouverte.
                </p>
              ) : (
                <ul className="divide-y divide-border-on-card border-y border-border-on-card">
                  {(coursesQuery.data ?? []).slice(0, 6).map((course) => {
                    const { day, month } = formatEventDate(course.startAt);
                    return (
                      <li
                        key={course.id}
                        className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-8">
                          <p className="w-16 shrink-0 text-center">
                            <span className="block font-display text-3xl text-on-card">{day}</span>
                            <span className="block font-sans text-xs font-semibold uppercase tracking-[0.16em] text-muted-on-card">
                              {month}
                            </span>
                          </p>
                          <div className="min-w-0">
                            <h3 className="font-display text-2xl text-on-card">{course.title}</h3>
                            <p className="mt-2 font-sans text-sm text-muted-on-card">
                              {SPACE_TYPE_LABELS[course.type] ?? course.type}
                              {' — '}
                              {formatCourseHours(course)}
                            </p>
                            <p className="mt-1 font-sans text-xs text-muted-on-card">
                              {course.remainingSpots} place(s) restante(s)
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </QueryState>
          </div>
        </section>

        <section id="centre" className="scroll-mt-24 bg-paper px-8 py-24">
          <div className="mx-auto max-w-7xl">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-muted-on-card">
              Le domaine
            </p>
            <h2 className="mt-3 font-display text-4xl text-on-card md:text-5xl">
              La vie au centre
            </h2>
            <div className="mt-14 grid gap-4 md:grid-cols-2 md:grid-rows-2">
              <div className="flex min-h-80 items-center justify-center bg-ink md:row-span-2">
                <div className="flex size-56 items-center justify-center rounded-full border border-gold">
                  <div className="text-center">
                    <HorseIcon className="mx-auto size-12 text-gold" />
                    <p className="mt-4 font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
                      Equime
                    </p>
                    <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.2em] text-muted">
                      Grand manège
                    </p>
                  </div>
                </div>
              </div>
              <img
                src="/images/experience-ecuries.webp"
                alt=""
                className="h-44 w-full object-cover md:h-full"
              />
              <img
                src="/images/experience-carriere.webp"
                alt=""
                className="h-44 w-full object-cover md:h-full"
              />
            </div>
          </div>
        </section>

        <section id="temoignage" className="scroll-mt-24 bg-primary px-8 py-24">
          <blockquote className="mx-auto max-w-4xl text-center">
            <p className="font-display text-3xl italic leading-snug text-primary-fg md:text-5xl">
              « L&apos;attention portée aux chevaux et aux cavaliers est constante. Equime est
              vraiment un second chez-soi. »
            </p>
            <footer className="mt-10 flex flex-col items-center gap-3">
              <img
                src="/images/temoin-claire.webp"
                alt=""
                className="size-14 rounded-full object-cover"
              />
              <div>
                <p className="font-sans text-sm font-semibold text-primary-fg">Claire M.</p>
                <p className="font-sans text-xs uppercase tracking-[0.16em] text-primary-fg/70">
                  Division amateur dressage
                </p>
              </div>
            </footer>
          </blockquote>
        </section>

        <section id="evenements" className="scroll-mt-24 bg-card px-8 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-4xl text-on-card md:text-5xl">Événements à venir</h2>
              <Link
                to="/login"
                className="font-sans text-sm font-medium text-muted-on-card underline-offset-4 hover:text-on-card hover:underline"
              >
                Voir le calendrier
              </Link>
            </div>
            <QueryState isPending={isPending} isError={isError} error={error} onRetry={refetch}>
              <ul className="divide-y divide-border-on-card border-y border-border-on-card">
                {events.map((event) => {
                  const { day, month } = formatEventDate(event.startAt);
                  const priceLabel = formatEventPrice(event.priceCents ?? 0);
                  return (
                    <li
                      key={event.id}
                      className="flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-8">
                        <p className="w-16 shrink-0 text-center">
                          <span className="block font-display text-3xl text-on-card">{day}</span>
                          <span className="block font-sans text-xs font-semibold uppercase tracking-[0.16em] text-muted-on-card">
                            {month}
                          </span>
                        </p>
                        <div className="min-w-0">
                          <h3 className="font-display text-2xl text-on-card">{event.title}</h3>
                          <p className="mt-2 max-w-xl font-sans text-sm text-muted-on-card">
                            {event.location || 'Centre Equime'}
                            {event.description ? ` — ${event.description}` : ''}
                          </p>
                          <p className="mt-2 font-sans text-sm font-semibold text-on-card">
                            {priceLabel}
                          </p>
                        </div>
                      </div>
                      <Link to="/register" className={cn(outlineLightClass, 'shrink-0')}>
                        S&apos;inscrire
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </QueryState>
          </div>
        </section>

        <section className="relative overflow-hidden bg-ink px-8 py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-fg/10"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="font-display text-4xl text-primary-fg md:text-6xl">
              Commencez votre saison
            </h2>
            <p className="mt-5 font-sans text-sm text-muted md:text-base">
              Créez un compte famille pour inscrire vos cavaliers, réserver les cours et suivre la
              facturation.
            </p>
            <Link to="/register" className={cn(primaryClass, 'mt-10')}>
              Créer un compte
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-paper">
        <div className="mx-auto grid max-w-7xl gap-12 px-8 py-16 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <BrandLockup tone="light" showMark={false} />
            <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-muted-on-card">
              Gestion de centre équestre : planning, cavalerie, réservations et facturation.
            </p>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-on-card">
              Contact
            </p>
            <address className="mt-4 space-y-2 font-sans text-sm not-italic text-on-card">
              {clubContact.address ? <p>{clubContact.address}</p> : null}
              {clubContact.phone ? (
                <p>
                  <a
                    href={`tel:${clubContact.phone.replace(/[^\d+]/g, '')}`}
                    className="hover:text-primary"
                  >
                    {clubContact.phone}
                  </a>
                </p>
              ) : null}
              {clubContact.email ? (
                <p>
                  <a href={`mailto:${clubContact.email}`} className="hover:text-primary">
                    {clubContact.email}
                  </a>
                </p>
              ) : null}
              {!clubContact.address && !clubContact.phone && !clubContact.email ? (
                <p className="text-muted-on-card">Coordonnées à venir.</p>
              ) : null}
            </address>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-on-card">
              Navigation
            </p>
            <ul className="mt-4 space-y-2 font-sans text-sm text-on-card">
              <li>
                <InPageLink href="#centre" className="hover:text-primary">
                  Le centre
                </InPageLink>
              </li>
              <li>
                <InPageLink href="#programmes" className="hover:text-primary">
                  Programmes
                </InPageLink>
              </li>
              <li>
                <InPageLink href="#formules" className="hover:text-primary">
                  Formules
                </InPageLink>
              </li>
              <li>
                <InPageLink href="#cours" className="hover:text-primary">
                  Cours
                </InPageLink>
              </li>
              <li>
                <InPageLink href="#evenements" className="hover:text-primary">
                  Événements
                </InPageLink>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-on-card">
              Espace membre
            </p>
            <ul className="mt-4 space-y-2 font-sans text-sm text-on-card">
              <li>
                <Link to="/login" className="hover:text-primary">
                  Connexion
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-primary">
                  Créer un compte
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-on-card">
              Newsletter
            </p>
            <p className="mt-4 font-sans text-sm text-muted-on-card">
              Les dates de stages et les nouvelles du club.
            </p>
            <NewsletterForm />
          </div>
        </div>
        <div className="border-t border-border-on-card px-8 py-6">
          <p className="mx-auto max-w-7xl text-right font-sans text-xs text-muted-on-card">
            Equime — centre équestre
          </p>
        </div>
      </footer>
    </div>
  );
}

/** @param {string} iso */
function formatEventDate(iso) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
  };
}

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const mutation = useMutation({
    mutationFn: (value) => subscribeNewsletter(value),
    onSuccess: () => setEmail(''),
  });

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(email);
      }}
    >
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Votre email"
          className="h-11 min-w-0 flex-1 border border-border-on-card bg-card px-3 font-sans text-sm text-on-card"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex size-11 items-center justify-center bg-primary text-primary-fg hover:bg-primary-light disabled:opacity-60"
          aria-label="S'inscrire à la newsletter"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="font-sans text-xs text-muted-on-card">
        En vous inscrivant, vous acceptez de recevoir les actualités du club. Désinscription sur
        demande.
      </p>
      {mutation.isSuccess ? (
        <Alert variant="success">Inscription enregistrée. Vérifiez votre boîte mail.</Alert>
      ) : null}
      {mutation.isError ? <Alert>{mutation.error.message}</Alert> : null}
    </form>
  );
}
