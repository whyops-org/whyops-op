'use client';

type Props = {
  children: React.ReactNode;
};

const Template = (props: Props) => {
  const { children } = props;

  return <>{children}</>;
};

export default Template;
