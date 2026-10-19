import { motion } from 'framer-motion';
import { FileText, BriefcaseBusiness, Sparkles } from 'lucide-react';

export const Greeting = () => {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full text-center"
      >
        <div className="mb-3 flex justify-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="size-7" />
          </div>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Resume Screening Agent
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Upload a candidate resume and provide the job requirements.
          The agent will analyze the candidate and help you assess their fit
          for the role.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="mt-8 grid w-full max-w-3xl gap-4 md:grid-cols-2"
      >
        <div className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="font-medium">Candidate Resume</h2>
              <p className="text-sm text-muted-foreground">
                Upload the candidate resume
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Use the attachment option below to upload the resume in a
            supported document format.
          </p>
        </div>

        <div className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <BriefcaseBusiness className="size-5" />
            </div>
            <div>
              <h2 className="font-medium">Job Requirements</h2>
              <p className="text-sm text-muted-foreground">
                Enter the role requirements
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Paste the job description or key requirements in the message box
            below together with the resume.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.18 }}
        className="mt-6 text-center text-sm text-muted-foreground"
      >
        <p>
          Add the resume, enter the job requirements, and send the request to
          start screening.
        </p>
      </motion.div>
    </div>
  );
};