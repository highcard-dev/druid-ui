local content = "loading..."

local values = {}
local searchTerm = ""


-- Hardcoded list of elements with their types based on server.properties.ini
local elementTypes = {
    ["allow-flight"] = "bool",
    ["allow-nether"] = "bool",
    ["broadcast-console-to-ops"] = "bool",
    ["broadcast-rcon-to-ops"] = "bool",
    ["debug"] = "bool",
    ["difficulty"] = "text",
    ["enable-command-block"] = "bool",
    ["enable-jmx-monitoring"] = "bool",
    ["enable-query"] = "bool",
    ["enable-rcon"] = "bool",
    ["enable-status"] = "bool",
    ["enforce-secure-profile"] = "bool",
    ["enforce-whitelist"] = "bool",
    ["entity-broadcast-range-percentage"] = "number",
    ["force-gamemode"] = "bool",
    ["function-permission-level"] = "number",
    ["gamemode"] = "text",
    ["generate-structures"] = "bool",
    ["generator-settings"] = "text",
    ["hardcore"] = "bool",
    ["hide-online-players"] = "bool",
    ["level-name"] = "text",
    ["level-seed"] = "text",
    ["level-type"] = "text",
    ["log-ips"] = "bool",
    ["max-chained-neighbor-updates"] = "number",
    ["max-players"] = "number",
    ["max-tick-time"] = "number",
    ["max-world-size"] = "number",
    ["motd"] = "text",
    ["network-compression-threshold"] = "number",
    ["online-mode"] = "bool",
    ["op-permission-level"] = "number",
    ["player-idle-timeout"] = "number",
    ["prevent-proxy-connections"] = "bool",
    ["pvp"] = "bool",
    ["query.port"] = "number",
    ["rate-limit"] = "number",
    ["rcon.password"] = "text",
    ["rcon.port"] = "number",
    ["require-resource-pack"] = "bool",
    ["resource-pack"] = "text",
    ["resource-pack-id"] = "text",
    ["resource-pack-prompt"] = "text",
    ["resource-pack-sha1"] = "text",
    ["server-ip"] = "text",
    ["server-port"] = "number",
    ["simulation-distance"] = "number",
    ["spawn-animals"] = "bool",
    ["spawn-monsters"] = "bool",
    ["spawn-npcs"] = "bool",
    ["spawn-protection"] = "number",
    ["sync-chunk-writes"] = "bool",
    ["text-filtering-config"] = "text",
    ["use-native-transport"] = "bool",
    ["view-distance"] = "number",
    ["white-list"] = "bool"
}

ServerProperties = {
    oninit = function ()
        d.request("server.properties.ini"):next(function (s)
            print(s)
        end)
        loadFileFromDeployment("server.properties.ini"):next(function (s)
           content = s

           --split by new line, ignore lines starting with # and empty lines
           for line in s:gmatch("[^\r\n]+") do
               if line:sub(1,1) ~= "#" and line:match("%S") then
                   local key, value = line:match("([^=]+)=(.*)")
                   if key and value then
                       values[key] = value
                   end
               end
           end

        end)
    end,
    view = function ()

        local gridElements = {}        
        
        -- Add search input at the top
        table.insert(gridElements, d(".search-container", {
            d("input", {
                type = "search",
                placeholder = "Filter fields...",
                value = searchTerm,
                onkeyup = function(e)
                    searchTerm = e.value
                end
            })
        }))
        
        -- Loop through values and create grid elements dynamically
        for key, value in pairs(values) do
            -- Filter based on search term
            if searchTerm == "" or key:lower():find(searchTerm, 1, true) then
                local id = "input-" .. key
                local t = elementTypes[key] or "text"
                local element = "input"
                local role = nil
                local checked = nil
                if t == "bool" then
                    t = "checkbox"
                    role = "switch"
                    checked = value == "true"
                end
                table.insert(gridElements, d(".grid", {
                    d("label", {
                        ["for"] = id
                    }, key),
                    d(element, {
                        type = t,
                        role = role,
                        checked = checked,
                        id = id,
                        value = value,
                        onchange = function(e)
                            print(e.value)
                            print(e.checked)
                            values[key] = e.checked and "true" or "false"
                            print(values[key])
                        end
                    }),
                }))
            end
        end
        
        -- Add save button at the end
        table.insert(gridElements, d("button", {
            onclick = function (e)
                -- Rebuild content from values
                local newContent = ""
                for key, value in pairs(values) do
                    newContent = newContent .. key .. "=" .. value .. "\n"
                end
                setFileFromDeployment("server.properties", newContent)
            end,
        }, "Save"))
        
        return d("main.container", gridElements)
    end,
}

mount(ServerProperties)
