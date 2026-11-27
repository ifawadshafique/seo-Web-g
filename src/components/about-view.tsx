import Image from "next/image";
import Link from "next/link";
import { cleanBody } from "@/lib/content-validation";

const steps = [
  [
    "Search for jobs",
    "Use keywords, country, and category to narrow your search.",
  ],
  [
    "Read the listing",
    "Check the employer, location, requirements, and closing date.",
  ],
  [
    "Verify the source",
    "Confirm the opening on the employer or recruiter’s official site.",
  ],
  [
    "Apply directly",
    "Follow the application instructions from the original source.",
  ],
];

const questions = [
  [
    "Do I need an account to browse jobs?",
    "You can browse and search public listings without an account.",
  ],
  [
    "Can I apply or upload a CV on Workboard?",
    "Follow the application link on the listing. The employer or recruiter handles applications and documents.",
  ],
  [
    "How do I check if a job is still open?",
    "Check the closing date and confirm availability with the employer or recruitment agency.",
  ],
  [
    "Can employers submit a vacancy?",
    "Yes. Send the vacancy details and application link through the Contact page for review.",
  ],
];

export function AboutView({ title, body }: { title: string; body: string }) {
  return (
    <main className="public-main portal-about">
      <section className="portal-jobs-heading">
        <h1>About Us</h1>
      </section>
      <div className="about-container">
        <section>
          <div className="about-intro">
            <h2>Find work wherever you’re looking</h2>
            <p>
              Workboard is an independent job directory. Browse opportunities
              around the world and check what each role requires before
              applying.
            </p>
          </div>
          <Image
            className="about-photo"
            src="/workboard-about.webp"
            alt="Job seekers reviewing information together at a table"
            width={1440}
            height={620}
            unoptimized
          />
        </section>
        <section className="about-steps">
          <h2>How it works</h2>
          <div className="about-step-grid">
            {steps.map(([heading, description]) => (
              <div key={heading}>
                <h3>{heading}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="about-cta">
          <h2>Explore open opportunities</h2>
          <Link className="button" href="/search">
            Browse jobs
          </Link>
          <Link className="button secondary" href="/contact">
            Submit a job
          </Link>
        </section>
        <section className="about-faq">
          <h2>Frequently asked questions</h2>
          {questions.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>
        <section className="about-published">
          <h2>{title}</h2>
          <div
            className="rich-content"
            dangerouslySetInnerHTML={{ __html: cleanBody(body) }}
          />
        </section>
      </div>
    </main>
  );
}
