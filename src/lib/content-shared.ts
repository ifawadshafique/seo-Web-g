import { Temporal } from "@js-temporal/polyfill";
export const scamNotice =
  "Never pay for an interview, a job offer, or a visa. Check the employer and official application page before applying. We do not collect payments or identity documents.";
export const jobTemplate =
  "<h2>Overview</h2><p></p><h2>Requirements</h2><ul><li></li></ul><h2>How to apply</h2><p></p>";
export function fromSiteTime(value: string, timezone: string) {
  return new Date(
    Temporal.PlainDateTime.from(value).toZonedDateTime(timezone, {
      disambiguation: "reject",
    }).epochMilliseconds,
  );
}
export function toSiteTime(value: string | Date, timezone: string) {
  return Temporal.Instant.from(new Date(value).toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}

export function effectiveJobStatus(job:{jobStatus:string;closingDate:Date|string|null},now=new Date()){return job.jobStatus==="OPEN"&&job.closingDate&&new Date(job.closingDate)<=now?"EXPIRED":job.jobStatus;}
