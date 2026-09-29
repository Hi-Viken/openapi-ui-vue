/// <reference types="vite/client" />

declare const __SPEC_URL__: string
declare const __SPEC_NAME__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/lib/generators/javascriptApiClientGenerator' {
  export class JavaScriptApiGenerator {
    constructor(options?: Record<string, any>)
    options: Record<string, any>
    loadFromSwaggerData(data: any): any
    generateClient(moduleName?: string, className?: string): Record<string, string | null>
  }
}

declare module '@/lib/generators/csharpApiClientGenerator' {
  export class CSharpApiGenerator {
    constructor(options?: Record<string, any>)
    options: Record<string, any>
    loadFromSwaggerData(data: any): any
    generateClient(namespace?: string, className?: string): Record<string, string | null>
  }
}

interface Window {
  openapiHost?: any
  swaggerData?: any
}
