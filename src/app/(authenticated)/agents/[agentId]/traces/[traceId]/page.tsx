import { Metadata } from 'next';
import { TraceDetailsPageContent } from '@/components/traces/trace-details-page-content';

type Props = {
    params: Promise<{ agentId: string; traceId: string }>;
}

export const metadata: Metadata = {
  title: "Trace Details | WhyOps",
  description: "WhyOps Trace Details",
};

const Page = async (props: Props) => {
  await props.params;
  return <TraceDetailsPageContent />;
};

export default Page;
