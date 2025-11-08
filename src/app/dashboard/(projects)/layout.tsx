import {SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup} from '@/components/ui/sidebar';

function ProjectSidebar() {
    return (
        <Sidebar>
            <SidebarContent>
                <SidebarGroup>
                    {/* Sidebar items go here */}
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}

export default function Layout({children}: {children: React.ReactNode}) {
    return (
        <SidebarProvider>
            <ProjectSidebar />
            <main>
                <SidebarTrigger />
                {children}
            </main>
        </SidebarProvider>
    );
}