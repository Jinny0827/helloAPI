import { useState } from 'react'
import { useProjectStore } from './store/projectStore'
import ProjectListPage from './pages/ProjectListPage'
import ProjectDetailPage from './pages/ProjectDetailPage'

export type Page = 'list' | 'detail'

export default function App() {
    const { activeProjectId, setActiveProject } = useProjectStore()
    const [page, setPage] = useState<Page>('list')

    const handleSelectProject = (id: string) => {
        setActiveProject(id)
        setPage('detail')
    }

    const handleBack = () => {
        setActiveProject(null)
        setPage('list')
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
            {page === 'list' && (
                <ProjectListPage onSelectProject={handleSelectProject} />
            )}
            {page === 'detail' && activeProjectId && (
                <ProjectDetailPage onBack={handleBack} />
            )}
        </div>
    )
}