import { motion } from 'framer-motion'

const defaultTransition = {
  duration: 0.75,
  ease: [0.22, 1, 0.36, 1],
}

const motionComponents = {
  div: motion.div,
  section: motion.section,
  header: motion.header,
}

export function FadeIn({
  as = 'div',
  children,
  className,
  delay = 0,
  id,
}) {
  const Component = motionComponents[as] ?? motion.div

  return (
    <Component
      className={className}
      id={id}
      initial={{ opacity: 0, y: 48 }}
      transition={{ ...defaultTransition, delay }}
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </Component>
  )
}
