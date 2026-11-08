import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from '../components/AppShell'
import { IconChevronLeft } from '../components/icons'
import { operator } from '../lib/operator'

const STAND = 'November 2026'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2">
      <h2 id={`${id}-h`} className="m-0 text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

const ul = 'm-0 flex list-disc flex-col gap-1.5 pl-5'

export function LegalPage() {
  const responsible = operator.name
    ? <>{operator.name}{operator.contact ? <>, erreichbar unter <span className="font-medium text-ink">{operator.contact}</span></> : null}</>
    : <>die Person, von der du das Zugangspasswort erhalten hast</>

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-6 pt-8 pb-16 md:pt-14">
      <div className="flex flex-col gap-5">
        <Link to="/" aria-label="Zurück" className="-ml-2.5 inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-subtle">
          <IconChevronLeft />
        </Link>
        <Logo />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[32px] leading-tight font-bold">Hinweise &amp; Datenschutz</h1>
          <p className="m-0 text-[15px] text-muted">Stand: {STAND}</p>
        </div>
      </div>

      <nav aria-label="Inhalt" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {([['betreiber', 'Betreiber'], ['datenschutz', 'Datenschutz'], ['haftung', 'Haftung & Nutzung']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-pine underline underline-offset-2">
            {label}
          </button>
        ))}
      </nav>

      <Section id="betreiber" title="Wer betreibt diese Seite?">
        <p className="m-0">
          my-wish-list ist ein <b>rein privates, nicht kommerzielles Angebot</b> für einen geschlossenen Kreis aus Familie und
          Freunden. Der Zugang ist nur mit einem persönlich weitergegebenen Zugangspasswort möglich. Es gibt keine Werbung,
          keine Bezahlfunktionen und keine Einnahmen.
        </p>
        <p className="m-0">
          Weil die Seite ausschließlich persönlichen bzw. familiären Zwecken dient und nicht geschäftsmäßig angeboten wird,
          besteht keine Impressumspflicht nach § 5 Digitale-Dienste-Gesetz (DDG) bzw. § 18 Medienstaatsvertrag.
        </p>
        <p className="m-0">Ansprechpartner für alle Fragen zu dieser Seite ist {responsible}.</p>
      </Section>

      <Section id="datenschutz" title="Datenschutz">
        <p className="m-0">
          Die Verarbeitung erfolgt im Rahmen einer privaten, familiären Tätigkeit (Art. 2 Abs. 2 lit. c DSGVO). Trotzdem soll
          transparent sein, was mit deinen Daten passiert:
        </p>

        <h3 className="m-0 mt-2 text-base font-bold text-ink">Welche Daten gespeichert werden</h3>
        <ul className={ul}>
          <li><b>Konto:</b> Username, Anzeigename, Passwort (nur als sicherer Hash) und ein Hash deines Wiederherstellungscodes. Eine E-Mail-Adresse wird nicht erhoben.</li>
          <li><b>Inhalte:</b> Anlässe, Mitgliedschaften, Wünsche (Titel, Beschreibung, Link, Preis), Zusagen und Beträge für Gruppengeschenke sowie kurze Notizen.</li>
          <li><b>Technische Daten:</b> Beim Aufruf verarbeiten die Hosting-Dienste (siehe unten) technisch bedingt deine IP-Adresse, Datum/Uhrzeit und Browserangaben, z. B. in Server- und Sicherheitsprotokollen.</li>
          <li><b>Missbrauchsschutz:</b> Zur Begrenzung von Fehlversuchen (Zugangspasswort, Registrierung, Passwort-Reset) wird ein nicht umkehrbarer, gesalzener Hashwert der IP-Adresse mit einem Zähler gespeichert – nie die IP-Adresse im Klartext.</li>
        </ul>

        <h3 className="m-0 mt-2 text-base font-bold text-ink">Zweck und Sichtbarkeit</h3>
        <p className="m-0">
          Die Daten werden nur genutzt, um die Wunschlisten-Funktionen bereitzustellen. Deine Wünsche sehen nur Mitglieder
          deiner Anlässe. Wer welchen Wunsch übernommen hat, bleibt vor dir als beschenkter Person verborgen. Es findet
          keine Auswertung, kein Tracking und keine Weitergabe zu Werbezwecken statt.
        </p>

        <h3 className="m-0 mt-2 text-base font-bold text-ink">Eingesetzte Dienste</h3>
        <ul className={ul}>
          <li>
            <b>GitHub Pages</b> (GitHub, Inc., USA) liefert die Dateien dieser Web-App aus. GitHub verarbeitet dabei
            Zugriffsdaten inkl. IP-Adresse zur Sicherheit des Dienstes; Details in der Datenschutzerklärung von GitHub.
          </li>
          <li>
            <b>Supabase</b> (Supabase, Inc., USA) stellt Datenbank, Anmeldung und Serverfunktion bereit. Dort liegen alle
            oben genannten Konto- und Inhaltsdaten
            {operator.dataRegion ? <> auf Servern in der Region <b>{operator.dataRegion}</b></> : null}.
            Supabase protokolliert technische Zugriffe (inkl. IP-Adresse) zur Absicherung des Dienstes.
          </li>
          <li>
            <b>Have I Been Pwned</b> (Passwortprüfung): Bei Registrierung und Passwortänderung prüft der Server, ob das
            Passwort aus bekannten Datenlecks stammt. Dabei werden nur die ersten 5 Zeichen eines Hashwerts übermittelt –
            weder das Passwort noch deine IP-Adresse oder dein Username.
          </li>
        </ul>
        <p className="m-0">
          Durch die Nutzung von Diensten mit Sitz in den USA kann nicht ausgeschlossen werden, dass Daten in die USA
          übermittelt werden. Schriftarten und alle übrigen Dateien werden selbst ausgeliefert; es werden keine weiteren
          Drittanbieter (z. B. Google Fonts, Analyse- oder Werbedienste) eingebunden.
        </p>

        <h3 className="m-0 mt-2 text-base font-bold text-ink">Speicherung im Browser</h3>
        <p className="m-0">
          Es werden keine Cookies gesetzt. Im lokalen Speicher deines Browsers liegt nur deine Anmeldesitzung
          (<code>mwl-auth</code>), im Sitzungsspeicher ein Merker, dass das Zugangspasswort eingegeben wurde. Beides ist
          für die Funktion technisch erforderlich (§ 25 Abs. 2 TDDDG) und wird beim Abmelden bzw. Schließen des Tabs entfernt.
        </p>

        <h3 className="m-0 mt-2 text-base font-bold text-ink">Speicherdauer und deine Rechte</h3>
        <p className="m-0">
          Deine Daten bleiben gespeichert, solange dein Konto besteht. Unter <i>Profil → Konto und alle Daten löschen</i> kannst
          du dein Konto jederzeit selbst löschen; dabei werden deine Wünsche, Zusagen und Mitgliedschaften sofort mit gelöscht.
          Darüber hinaus kannst du dich für Auskunft, Berichtigung, Löschung oder Einschränkung an den oben genannten
          Ansprechpartner wenden. Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
        </p>
      </Section>

      <Section id="haftung" title="Haftung &amp; Nutzung">
        <ul className={ul}>
          <li>
            <b>Ohne Gewähr:</b> Die App wird privat, unentgeltlich und ohne Garantie für Verfügbarkeit, Fehlerfreiheit oder
            dauerhafte Speicherung der Daten bereitgestellt. Sie kann jederzeit geändert oder eingestellt werden. Bewahre
            wichtige Informationen bei Bedarf zusätzlich selbst auf.
          </li>
          <li>
            <b>Inhalte der Mitglieder:</b> Wünsche, Beschreibungen, Links und Notizen stammen von den jeweiligen Mitgliedern,
            die dafür selbst verantwortlich sind. Bitte keine sensiblen Daten (z. B. Adressen, Kontodaten, Gesundheitsdaten)
            eintragen. Rechtswidrige Inhalte werden nach Hinweis entfernt.
          </li>
          <li>
            <b>Externe Links:</b> Links zu Shops oder anderen Seiten werden von Mitgliedern eingetragen. Für deren Inhalte,
            Preise und Datenschutz sind ausschließlich die jeweiligen Anbieter verantwortlich. Zum Zeitpunkt der Verlinkung
            waren keine Rechtsverstöße erkennbar.
          </li>
          <li>
            <b>Keine Zahlungen:</b> Beträge bei Gruppengeschenken sind nur Notizen zur Absprache. Über die App wird kein Geld
            eingesammelt, verwaltet oder überwiesen – das regelt ihr untereinander.
          </li>
          <li>
            <b>Fairer Umgang:</b> Gib das Zugangspasswort nur an Personen weiter, die zum Kreis gehören, und lade nur Menschen
            ein, die einverstanden sind. Konten, die missbräuchlich genutzt werden, können gelöscht werden.
          </li>
        </ul>
        <p className="m-0">
          Der Quellcode steht unter der MIT-Lizenz. Die verwendeten Schriftarten Inter und Bricolage Grotesque stehen unter
          der SIL Open Font License.
        </p>
      </Section>
    </main>
  )
}
