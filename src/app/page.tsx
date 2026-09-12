import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/groups';
import styles from './landing.module.css';

// Phone UAs only — iPad and other tablets keep the marketing page, they have
// the screen real estate for it. Checked server-side so there's no flash of
// the marketing hero before a client-side redirect would kick in.
const MOBILE_UA = /Android|iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini/i;

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/groups');

  const userAgent = (await headers()).get('user-agent') ?? '';
  if (MOBILE_UA.test(userAgent)) redirect('/login');

  return (
    <main className={styles.stage}>
      <nav className={styles.nav}>
        <span className={styles.brand}>
          <Image src="/logo.png" alt="Meerkash" width={139} height={100} priority />
        </span>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navLink}>Sign in</Link>
          <Link href="/signup" className={styles.navCta}>Get started</Link>
        </div>
      </nav>

      <div className={styles.hero}>
        <div>
          <p className={styles.slogan}>Meerkash: Because your network covers each other.</p>
          <h1 className={styles.headline}>
            <span>Instinctive sharing.</span>
            <span>Watchful trust.</span>
          </h1>
          <p className={styles.lede}>
            Just as a meerkat mob relies on every member to stand guard and support the group,
            Meerkash is built on the instinct to look out for your own. We created a space where
            advancing funds and balancing expenses with your network is natural, reliable, and
            entirely stress-free.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/signup" className={styles.ctaPrimary}>Begin Your Journey</Link>
            <Link href="#how-it-works" className={styles.ctaSecondary}>See how it works</Link>
          </div>
        </div>

        <div className={styles.receiptWrap}>
          <div className={styles.receipt}>
            <p className={styles.receiptTitle}>Barkada Trip</p>
            <hr className={styles.receiptDivider} />
            <div className={styles.receiptRow}><span>Dinner</span><span>₱840</span></div>
            <div className={styles.receiptRow}><span>Gas</span><span>₱600</span></div>
            <div className={styles.receiptRow}><span>Hotel</span><span>₱2,400</span></div>
            <hr className={styles.receiptDivider} />
            <div className={styles.receiptTotalRow}><span>You get back</span><span>₱620</span></div>
          </div>
          <div className={styles.stamp}>
            SETTLED
            <Check size={20} strokeWidth={3} />
          </div>
        </div>
      </div>

      <section id="how-it-works" className={styles.features}>
        <div className={styles.feature}>
          <span className={styles.featureDot} aria-hidden="true" />
          <p className={styles.featureTitle}>No more mental math</p>
          <p className={styles.featureBody}>
            Add who was there. Meerkash works out each person&apos;s exact share, split evenly
            or by percentage.
          </p>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureDot} aria-hidden="true" />
          <p className={styles.featureTitle}>Debts cancel out</p>
          <p className={styles.featureBody}>
            Owe Ana and owed by Marco? Meerkash shows one real balance, not ten scattered
            ones.
          </p>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureDot} aria-hidden="true" />
          <p className={styles.featureTitle}>Settle up for real</p>
          <p className={styles.featureBody}>
            Record a GCash, Maya, bank or cash payment. The other person confirms it, and the
            balance clears.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        Every group picks its own currency — pesos, dollars, or more.
      </footer>
    </main>
  );
}
