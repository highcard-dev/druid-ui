local sp = "loading..."

Splash = {
    oninit = function ()
        print("ININININIT")

    end,
    view = function ()
        return d("div.p-2", {
            d("textarea", {
                onkeyup = function (e)
                    --local newContent = e.target.value
                    --setFileFromDeployment("server.properties", newContent):await()
                    print(e)
                    sp = e
                end,
            }, sp),
            d("br"),
            d("button.bg-blue-700.p-2", {
                onclick = function ()
                    print("Save button clicked")
                end,
            }, "Save"),
            d("button.bg-primary.p-2", {
            }, "Save primary"),
            d("Link", {to= ""}, "Go to root"),
        })
    end,
}
mount(Splash)