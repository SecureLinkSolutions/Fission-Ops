import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ext, Page, Section } from '../components/ui.tsx';
import { Attribution } from './DataHealth.tsx';

export function Licences() {
  return (
    <Page title="Licences and attribution" intro="Every source Firewatch draws on, the licence it is published under, and how it is credited.">
      <Attribution />
      <Section title="Firewatch itself" id="self">
        <p>
          Firewatch is part of Fission Ops by NullVector Security. It indexes and links published content; it does not claim ownership of any rule, advisory,
          or score it displays.
        </p>
      </Section>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy" intro="What Firewatch stores, where, and for how long.">
      <Section title="In your browser" id="browser">
        <p>
          Your platform choice, colour theme, watchlist, and the optional “new since your last visit” list are kept in this browser's local storage. They are
          never sent to the server. Clearing site data removes them; the Watchlist page can export and import your watchlist.
        </p>
      </Section>
      <Section title="On the server" id="server">
        <p>
          Firewatch serves static snapshot files and sets no cookies. It runs no analytics or third-party scripts. Standard web server request logs may be
          kept by whoever operates this instance.
        </p>
        {FEEDBACK_URL ? (
          <p>
            This copy is a static site with no server of its own. <Link to="/feedback">Feedback</Link> opens an external page, and what you write there is
            handled by that service. Nothing else about you is collected.
          </p>
        ) : (
          <p>
            If you <Link to="/feedback">send feedback</Link>, the message, the page you were on, and an optional contact address you choose to give are
            stored on the server so the operator can read them. Nothing else about you is collected.
          </p>
        )}
      </Section>
      <Section title="Links out" id="links">
        <p>Headlines, advisories, and rule sources link to their publishers. Following a link takes you to that publisher's site and its privacy terms.</p>
      </Section>
    </Page>
  );
}

/** On static hosting there is no server to post to, so feedback goes to an external URL (a GitHub issue form or mailto:). */
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL;

function feedbackHref(base: string): string {
  const page = document.referrer || window.location.href;
  return `${base}${base.includes('?') ? '&' : '?'}body=${encodeURIComponent(`Page: ${page}\n\n`)}`;
}

export function Feedback() {
  if (FEEDBACK_URL) {
    return (
      <Page title="Send feedback" intro="Report a wrong count, a missing source, or anything else.">
        <Section title="How to send it" id="external">
          <p>This copy of Firewatch is a static site, so feedback goes through the link below. Anything you write there is visible to whoever can see that page.</p>
          <p>
            <Ext href={feedbackHref(FEEDBACK_URL)} className="btn">
              Send feedback
            </Ext>
          </p>
        </Section>
      </Page>
    );
  }
  return <FeedbackForm />;
}

function FeedbackForm() {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  return (
    <Page title="Send feedback" intro="Report a wrong count, a missing source, or anything else. Feedback goes to the operator of this Firewatch instance.">
      <Section title="Your message" id="form">
        {state === 'sent' ? (
          <p className="notice notice-good" role="status">
            Thank you. Your feedback was received.
          </p>
        ) : (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setState('sending');
              try {
                const res = await fetch('api/feedback', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ message, contact, page: document.referrer || window.location.href }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
                setState('sent');
              } catch (err) {
                setErrorText(err instanceof Error ? err.message : String(err));
                setState('error');
              }
            }}
          >
            <label>
              <span>Message</span>
              <textarea required minLength={5} maxLength={4000} rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <label>
              <span>Contact (optional)</span>
              <input type="text" maxLength={200} value={contact} placeholder="Email or handle, if you would like a reply" onChange={(e) => setContact(e.target.value)} />
            </label>
            <div>
              <button type="submit" className="btn" disabled={state === 'sending' || message.trim().length < 5}>
                {state === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
            {state === 'error' && (
              <p className="notice notice-bad" role="alert">
                Feedback could not be sent ({errorText}). Please try again later.
              </p>
            )}
            <p className="muted small">
              See <Link to="/privacy">Privacy</Link> for what is stored.
            </p>
          </form>
        )}
      </Section>
    </Page>
  );
}

export function NotFound() {
  return (
    <Page title="Page not found">
      <p>
        There is nothing at this address. Go to the <Link to="/">Overview</Link> or search the KEV catalog above.
      </p>
    </Page>
  );
}
