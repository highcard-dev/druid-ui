local sp = "Some content"

-- Navigation component
Navigation = {
    view = function ()
        return d("nav", {
            style = "padding: 10px; background-color: #f0f0f0; margin-bottom: 20px;",
            d("a", {
                href = "/",
                style = "margin-right: 15px; text-decoration: none; color: #007bff;",
            }, "Home"),
            d("a", {
                href = "/dashboard",
                style = "margin-right: 15px; text-decoration: none; color: #007bff;",
            }, "Dashboard"),
            d("a", {
                href = "/settings",
                style = "margin-right: 15px; text-decoration: none; color: #007bff;",
            }, "Settings"),
        })
    end,
}

-- Splash/Home page component
Splash = {
    oninit = function ()
        print("Splash page initialized")
    end,
    view = function ()
        return d("div", {
            Navigation.view(),
            d("h1", {}, "Welcome to Druid UI Routing Example"),
            d("p", {}, "This is the home page. Use the navigation above to explore different routes."),
            d("div", {
                style = "margin-top: 20px;",
                d("h3", {}, "File Editor Demo"),
                d("textarea", {
                    rows = "5",
                    cols = "50",
                    style = "width: 100%; margin-bottom: 10px;",
                    onkeyup = function (e)
                        print("Content changed:", e.target.value)
                        sp = e.target.value
                    end,
                }, sp),
                d("br"),
                d("button", {
                    style = "padding: 5px 15px; background-color: #007bff; color: white; border: none; cursor: pointer;",
                    onclick = function ()
                        print("Save button clicked - content:", sp)
                        alert("Content saved!")
                    end,
                }, "Save"),
            })
        })
    end,
}

-- Dashboard component
Dashboard = {
    oninit = function ()
        print("Dashboard page initialized")
    end,
    view = function ()
        return d("div", {
            Navigation.view(),
            d("h1", {}, "Dashboard"),
            d("p", {}, "Welcome to your dashboard! Here you can view analytics and manage your data."),
            d("div", {
                style = "display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;",
                d("div", {
                    style = "padding: 20px; border: 1px solid #ddd; border-radius: 5px;",
                    d("h3", {}, "Statistics"),
                    d("p", {}, "Total Users: 1,234"),
                    d("p", {}, "Active Sessions: 56"),
                    d("p", {}, "Revenue: $12,345"),
                }),
                d("div", {
                    style = "padding: 20px; border: 1px solid #ddd; border-radius: 5px;",
                    d("h3", {}, "Recent Activity"),
                    d("ul", {
                        d("li", {}, "User John Doe logged in"),
                        d("li", {}, "New order #1001 received"),
                        d("li", {}, "System backup completed"),
                    }),
                }),
            })
        })
    end,
}

-- Settings component
Settings = {
    oninit = function ()
        print("Settings page initialized")
    end,
    view = function ()
        return d("div", {
            Navigation.view(),
            d("h1", {}, "Settings"),
            d("p", {}, "Configure your application settings here."),
            d("div", {
                style = "margin-top: 20px;",
                d("form", {
                    d("div", {
                        style = "margin-bottom: 15px;",
                        d("label", {
                            style = "display: block; margin-bottom: 5px; font-weight: bold;",
                        }, "Theme:"),
                        d("select", {
                            style = "padding: 5px; width: 200px;",
                            onchange = function (e)
                                print("Theme changed to:", e.target.value)
                            end,
                        }, {
                            d("option", { value = "light" }, "Light"),
                            d("option", { value = "dark" }, "Dark"),
                            d("option", { value = "auto" }, "Auto"),
                        }),
                    }),
                    d("div", {
                        style = "margin-bottom: 15px;",
                        d("label", {
                            style = "display: block; margin-bottom: 5px; font-weight: bold;",
                        }, "Notifications:"),
                        d("input", {
                            type = "checkbox",
                            checked = true,
                            onchange = function (e)
                                print("Notifications enabled:", e.target.checked)
                            end,
                        }),
                        d("span", { style = "margin-left: 5px;" }, "Enable email notifications"),
                    }),
                    d("div", {
                        style = "margin-bottom: 15px;",
                        d("label", {
                            style = "display: block; margin-bottom: 5px; font-weight: bold;",
                        }, "Auto-save interval (seconds):"),
                        d("input", {
                            type = "number",
                            value = "30",
                            min = "5",
                            max = "300",
                            style = "padding: 5px; width: 100px;",
                            onchange = function (e)
                                print("Auto-save interval set to:", e.target.value)
                            end,
                        }),
                    }),
                    d("button", {
                        type = "button",
                        style = "padding: 10px 20px; background-color: #28a745; color: white; border: none; cursor: pointer; margin-right: 10px;",
                        onclick = function ()
                            print("Settings saved!")
                            alert("Settings saved successfully!")
                        end,
                    }, "Save Settings"),
                    d("button", {
                        type = "button",
                        style = "padding: 10px 20px; background-color: #6c757d; color: white; border: none; cursor: pointer;",
                        onclick = function ()
                            print("Settings reset to defaults")
                            alert("Settings reset to defaults!")
                        end,
                    }, "Reset to Defaults"),
                }),
            })
        })
    end,
}

-- Configure routing
route(Splash, {
    ["/dashboard"] = Dashboard,
    ["/settings"] = Settings,
})