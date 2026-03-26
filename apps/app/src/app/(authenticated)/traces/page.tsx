import { Metadata } from 'next';
import { TracesPageContent } from '@/components/traces/traces-page-content';

export const metadata: Metadata = {
  title: "Traces | WhyOps",
  description: "WhyOps Traces",
};

const Page = async () => {
  return <TracesPageContent />;
};

export default Page;
